<script>
  import { onMount } from 'svelte';
  
  let prompt = '';
  let generatedCommand = '';
  let isGenerating = false;
  let isExecuting = false;
  let output = '';
  let logs = [];
  let error = '';
  
  const API_BASE = '/api';
  
  async function generateCommand() {
    if (!prompt.trim()) {
      error = 'Please enter a prompt';
      return;
    }
    
    isGenerating = true;
    error = '';
    
    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate command');
      }
      
      generatedCommand = data.command;
    } catch (err) {
      error = err.message;
    } finally {
      isGenerating = false;
    }
  }
  
  async function executeCommand() {
    if (!generatedCommand.trim()) {
      error = 'No command to execute';
      return;
    }
    
    isExecuting = true;
    output = '';
    error = '';
    
    try {
      const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: generatedCommand })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute command');
      }
      
      // Handle SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'stdout' || data.type === 'stderr') {
              output += data.data;
            } else if (data.type === 'error') {
              error = data.data;
            } else if (data.type === 'complete') {
              // Command completed
              await loadLogs();
            }
          }
        }
      }
    } catch (err) {
      error = err.message;
    } finally {
      isExecuting = false;
    }
  }
  
  async function loadLogs() {
    try {
      const response = await fetch(`${API_BASE}/logs`);
      const data = await response.json();
      logs = data.logs || [];
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }
  
  function runFromHistory(logEntry) {
    generatedCommand = logEntry.command;
    prompt = 'Re-run from history';
  }
  
  onMount(() => {
    loadLogs();
  });
</script>

<svelte:head>
  <title>Smart CLI - AI Command Generator</title>
</svelte:head>

<main>
  <div class="container">
    <header>
      <h1>🤖 Smart CLI</h1>
      <p>AI-Powered Command Generator & Executor</p>
    </header>
    
    <div class="card">
      <h2>Generate Command</h2>
      <div class="input-group">
        <textarea
          bind:value={prompt}
          placeholder="Describe what you want to do (e.g., 'list all files', 'show node version')"
          rows="3"
          disabled={isGenerating || isExecuting}
        ></textarea>
        <button 
          on:click={generateCommand}
          disabled={isGenerating || isExecuting}
          class="btn btn-primary"
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
    
    {#if generatedCommand}
      <div class="card">
        <h2>Generated Command</h2>
        <div class="command-box">
          <code>{generatedCommand}</code>
        </div>
        <button 
          on:click={executeCommand}
          disabled={isExecuting}
          class="btn btn-success"
        >
          {isExecuting ? 'Executing...' : 'Run Command'}
        </button>
      </div>
    {/if}
    
    {#if error}
      <div class="card error">
        <strong>Error:</strong> {error}
      </div>
    {/if}
    
    {#if output}
      <div class="card">
        <h2>Output</h2>
        <pre class="output-box">{output}</pre>
      </div>
    {/if}
    
    {#if logs.length > 0}
      <div class="card">
        <h2>Execution History</h2>
        <div class="history-list">
          {#each logs as log}
            <div class="history-item" class:success={log.status === 'success'} class:failed={log.status === 'failed' || log.status === 'error'}>
              <div class="history-header">
                <span class="timestamp">{new Date(log.timestamp).toLocaleString()}</span>
                <span class="status">{log.status}</span>
                <span class="duration">{log.duration}ms</span>
              </div>
              <div class="history-command">
                <code>{log.command}</code>
              </div>
              <button 
                on:click={() => runFromHistory(log)}
                class="btn btn-small"
                disabled={isExecuting}
              >
                Run Again
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  
  main {
    padding: 2rem 1rem;
    max-width: 100%;
  }
  
  .container {
    max-width: 800px;
    margin: 0 auto;
  }
  
  header {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }
  
  h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
  }
  
  h2 {
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
    color: #333;
  }
  
  .card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .card.error {
    background: #fee;
    color: #c33;
  }
  
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }
  
  textarea:focus {
    outline: none;
    border-color: #667eea;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: #667eea;
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
  }
  
  .btn-success {
    background: #48bb78;
    color: white;
  }
  
  .btn-success:hover:not(:disabled) {
    background: #38a169;
  }
  
  .btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  
  .command-box {
    background: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    overflow-x: auto;
  }
  
  .command-box code {
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    color: #2d3748;
  }
  
  .output-box {
    background: #1a202c;
    color: #68d391;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .history-item {
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }
  
  .history-item.success {
    border-color: #48bb78;
    background: #f0fff4;
  }
  
  .history-item.failed {
    border-color: #f56565;
    background: #fff5f5;
  }
  
  .history-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #718096;
    flex-wrap: wrap;
  }
  
  .status {
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .history-command {
    background: #f7fafc;
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    overflow-x: auto;
  }
  
  .history-command code {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }
  
  @media (max-width: 600px) {
    main {
      padding: 1rem 0.5rem;
    }
    
    h1 {
      font-size: 2rem;
    }
    
    .card {
      padding: 1rem;
    }
  }
</style>
