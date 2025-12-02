const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const { sanitizeCommand, createLogEntry, truncateOutput } = require('../shared/utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SANDBOX_DIR = path.join(__dirname, '..', 'sandbox');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

// Execution state
let isExecuting = false;
const EXECUTION_TIMEOUT = 30000; // 30 seconds

/**
 * Load logs from file
 */
function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = fs.readFileSync(LOGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading logs:', err);
  }
  return [];
}

/**
 * Save logs to file
 */
function saveLogs(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Error saving logs:', err);
  }
}

/**
 * POST /api/generate
 * Generate a shell command based on user prompt
 * TODO: Integrate with OpenAI API for real command generation
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // TODO: Replace with actual OpenAI API call
    // const openaiApiKey = process.env.OPENAI_API_KEY;
    // if (!openaiApiKey) {
    //   return res.status(500).json({ error: 'OpenAI API key not configured' });
    // }

    // For MVP: Return example commands based on keywords in prompt
    let command = 'echo "Command generated from: ' + prompt + '"';
    
    const promptLower = prompt.toLowerCase();
    if (promptLower.includes('list') && promptLower.includes('file')) {
      command = 'ls -la';
    } else if (promptLower.includes('git') && promptLower.includes('status')) {
      command = 'git status';
    } else if (promptLower.includes('node') && promptLower.includes('version')) {
      command = 'node --version';
    } else if (promptLower.includes('current') && promptLower.includes('directory')) {
      command = 'pwd';
    } else if (promptLower.includes('create') && promptLower.includes('file')) {
      command = 'touch example.txt && echo "File created" > example.txt';
    }

    // Validate generated command
    const validation = sanitizeCommand(command);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Generated command failed validation', 
        details: validation.error 
      });
    }

    res.json({
      command,
      prompt,
      note: 'This is a stub implementation. TODO: Integrate OpenAI API for real command generation.'
    });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate command' });
  }
});

/**
 * POST /api/execute
 * Execute a shell command in the sandbox
 * Streams output via Server-Sent Events
 */
app.post('/api/execute', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Validate command
    const validation = sanitizeCommand(command);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if already executing
    if (isExecuting) {
      return res.status(429).json({ 
        error: 'Another command is currently executing. Please wait.' 
      });
    }

    isExecuting = true;
    const startTime = Date.now();

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    let output = '';
    let errorOutput = '';
    let exitCode = null;

    // Parse command into executable and args
    const commandParts = command.split(' ');
    const executable = commandParts[0];
    const args = commandParts.slice(1);

    // Execute command in sandbox
    const childProcess = spawn(executable, args, {
      cwd: SANDBOX_DIR,
      timeout: EXECUTION_TIMEOUT,
      shell: true,
      env: { ...process.env, PATH: process.env.PATH }
    });

    // Stream stdout
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: chunk })}\n\n`);
    });

    // Stream stderr
    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      res.write(`data: ${JSON.stringify({ type: 'stderr', data: chunk })}\n\n`);
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      exitCode = code;
      const duration = Date.now() - startTime;

      // Create log entry
      const logEntry = createLogEntry({
        command,
        status: code === 0 ? 'success' : 'failed',
        exitCode: code,
        output: truncateOutput(output),
        error: truncateOutput(errorOutput),
        duration
      });

      // Save to logs
      const logs = loadLogs();
      logs.unshift(logEntry);
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(100);
      }
      saveLogs(logs);

      // Send completion event
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        exitCode: code,
        duration 
      })}\n\n`);
      
      res.end();
      isExecuting = false;
    });

    // Handle errors
    childProcess.on('error', (error) => {
      const duration = Date.now() - startTime;
      
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        data: error.message 
      })}\n\n`);

      // Log the error
      const logEntry = createLogEntry({
        command,
        status: 'error',
        exitCode: -1,
        output: truncateOutput(output),
        error: truncateOutput(error.message),
        duration
      });

      const logs = loadLogs();
      logs.unshift(logEntry);
      saveLogs(logs);

      res.end();
      isExecuting = false;
    });

    // Handle timeout
    setTimeout(() => {
      if (isExecuting && !childProcess.killed) {
        childProcess.kill('SIGTERM');
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          data: 'Command execution timeout (30s)' 
        })}\n\n`);
      }
    }, EXECUTION_TIMEOUT + 1000);

  } catch (error) {
    console.error('Execute error:', error);
    isExecuting = false;
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to execute command' });
    } else {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        data: error.message 
      })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/logs
 * Get execution history
 */
app.get('/api/logs', (req, res) => {
  try {
    const logs = loadLogs();
    res.json({ logs });
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    isExecuting 
  });
});

// Serve frontend static files (for production)
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Smart CLI Backend running on port ${PORT}`);
  console.log(`Sandbox directory: ${SANDBOX_DIR}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
