const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Use dynamic data directory based on environment
function getDataDir() {
  if (process.env.NODE_ENV === 'production') {
    // In production, try /var/data or fallback to /tmp
    if (fs.existsSync('/var/data')) {
      return '/var/data';
    }
    return '/tmp/meitzad-data';
  }
  return path.join(__dirname, '../../data');
}

const DATA_DIR = getDataDir();
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'meitzad.db');
const MAX_BACKUPS = 7; // Keep last 7 backups

// Ensure backup directory exists (with error handling)
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
} catch (error) {
  console.warn('Could not create backup directory:', error.message);
}

// Create a backup
function createBackup(manual = false) {
  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      console.log('Database file not found, skipping backup');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = manual ? '-manual' : '';
    const backupFilename = `meitzad-${timestamp}${suffix}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);

    console.log(`✓ Backup created: ${backupFilename}`);

    // Clean old backups
    cleanOldBackups();

    return backupPath;
  } catch (error) {
    console.error('Backup failed:', error);
    return null;
  }
}

// Delete old backups, keeping only the most recent MAX_BACKUPS
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by newest first

    // Delete files beyond MAX_BACKUPS
    const toDelete = files.slice(MAX_BACKUPS);

    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    }
  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
}

// List all backups
function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stat.size,
          created: stat.mtime
        };
      })
      .sort((a, b) => b.created - a.created);

    return files;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Restore from backup
function restoreBackup(backupFilename) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    // Create a backup of current state before restore
    const preRestoreBackup = createBackup(true);
    console.log(`Pre-restore backup created: ${preRestoreBackup}`);

    // Copy backup to database location
    fs.copyFileSync(backupPath, DB_PATH);

    console.log(`✓ Database restored from: ${backupFilename}`);
    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    return false;
  }
}

// Start scheduled backup (daily at midnight)
function startBackupScheduler() {
  // Run at midnight every day
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled backup...');
    createBackup();
  });

  // Also create a backup on startup
  createBackup();
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create':
    case 'manual':
      createBackup(true);
      break;
    case 'list':
      const backups = listBackups();
      console.log('\nAvailable backups:');
      backups.forEach(b => {
        console.log(`  ${b.name} (${(b.size / 1024).toFixed(1)} KB) - ${b.created.toLocaleString('he-IL')}`);
      });
      break;
    case 'restore':
      if (args[1]) {
        restoreBackup(args[1]);
      } else {
        console.log('Usage: node backup.js restore <backup-filename>');
      }
      break;
    default:
      console.log('Usage: node backup.js [create|list|restore <filename>]');
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  startBackupScheduler
};
