import os
import shutil
import logging
import datetime
import glob
from core.config import settings

logger = logging.getLogger("sentiq.backup")

def perform_db_backup():
    """
    Performs a backup of the SQLite database if configured.
    Maintains a rolling window of the last 7 backups.
    """
    if not settings.DATABASE_URL.startswith("sqlite:///"):
        logger.info("Database is not SQLite. Skipping file-based backup.")
        return

    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        logger.warning(f"Database file not found at {db_path}. Skipping backup.")
        return

    backup_dir = "./data/backups"
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    db_filename = os.path.basename(db_path)
    backup_filename = f"{db_filename}.{timestamp}.bak"
    backup_path = os.path.join(backup_dir, backup_filename)

    try:
        shutil.copy2(db_path, backup_path)
        logger.info(f"Successfully backed up database to {backup_path}")
        
        # Prune old backups (keep last 7)
        backup_files = sorted(glob.glob(os.path.join(backup_dir, f"{db_filename}.*.bak")))
        if len(backup_files) > 7:
            for old_file in backup_files[:-7]:
                try:
                    os.remove(old_file)
                    logger.info(f"Pruned old backup: {old_file}")
                except Exception as e:
                    logger.error(f"Failed to prune old backup {old_file}: {e}")
                    
    except Exception as e:
        logger.error(f"Failed to backup database: {e}")
