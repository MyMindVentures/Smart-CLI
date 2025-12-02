/**
 * Shared utilities for sanitization and logging
 */

/**
 * Sanitizes command input by checking for dangerous patterns
 * @param {string} command - The command to sanitize
 * @returns {object} - {valid: boolean, error: string|null}
 */
function sanitizeCommand(command) {
  if (!command || typeof command !== 'string') {
    return { valid: false, error: 'Command must be a non-empty string' };
  }

  // Blacklist of dangerous commands and patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,  // rm -rf /
    /:\(\)\{\s*:\|:&\s*\};:/,  // fork bomb
    /shutdown/,
    /reboot/,
    /halt/,
    /poweroff/,
    /init\s+0/,
    /init\s+6/,
    /killall/,
    /pkill.*-9/,
    /dd\s+if=/,  // dangerous dd operations
    /mkfs\./,  // filesystem formatting
    /fdisk/,
    />\s*\/dev\/sd/,  // writing to disk devices
    /chmod\s+777/,  // overly permissive
    /chown\s+root/,
    /sudo/,
    /su\s/,
    /wget.*\|.*sh/,  // downloading and executing
    /curl.*\|.*sh/,
    /eval.*\$/,  // eval with variables
    /exec.*\$/,
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, error: `Command contains dangerous pattern: ${pattern}` };
    }
  }

  // Check for path traversal attempts
  if (command.includes('..')) {
    return { valid: false, error: 'Command contains path traversal attempt (..)' };
  }

  // Check for absolute paths (should work within sandbox only)
  if (/^\/|^\s*\//.test(command) || command.includes(' /')) {
    // Allow some safe absolute paths
    const safeAbsolutePaths = ['/usr/bin', '/bin', '/tmp'];
    const hasUnsafePath = !safeAbsolutePaths.some(safePath => command.includes(safePath));
    if (hasUnsafePath && (command.startsWith('/') || command.match(/\s+\//))) {
      return { valid: false, error: 'Command contains absolute paths outside sandbox' };
    }
  }

  return { valid: true, error: null };
}

/**
 * Logs execution information to a structured format
 * @param {object} logEntry - The log entry object
 * @returns {object} - Formatted log entry with timestamp
 */
function createLogEntry(logEntry) {
  return {
    timestamp: new Date().toISOString(),
    command: logEntry.command || '',
    status: logEntry.status || 'unknown',
    exitCode: logEntry.exitCode !== undefined ? logEntry.exitCode : null,
    output: logEntry.output || '',
    error: logEntry.error || '',
    duration: logEntry.duration || 0,
  };
}

/**
 * Validates that a path is within the sandbox
 * @param {string} path - The path to validate
 * @returns {boolean} - True if path is safe
 */
function isPathSafe(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // Reject paths with traversal attempts
  if (path.includes('..')) {
    return false;
  }
  
  // Reject absolute paths
  if (path.startsWith('/')) {
    return false;
  }
  
  return true;
}

/**
 * Truncates output to prevent excessive log sizes
 * @param {string} output - The output to truncate
 * @param {number} maxLength - Maximum length (default 10000)
 * @returns {string} - Truncated output
 */
function truncateOutput(output, maxLength = 10000) {
  if (!output) return '';
  if (output.length <= maxLength) return output;
  
  return output.substring(0, maxLength) + '\n... (truncated)';
}

module.exports = {
  sanitizeCommand,
  createLogEntry,
  isPathSafe,
  truncateOutput,
};
