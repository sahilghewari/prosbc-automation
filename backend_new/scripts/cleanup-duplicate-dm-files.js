import database from '../config/database.js';
import ProSBCDMFile from '../models/ProSBCDMFile.js';

(async () => {
  try {
    console.log('🧹 Cleaning up duplicate DM files...');
    await database.connect();

    // Find all duplicate combinations of file_name + prosbc_instance_id
    const duplicates = await database.sequelize.query(`
      SELECT file_name, prosbc_instance_id, COUNT(*) as count
      FROM prosbc_dm_files
      GROUP BY file_name, prosbc_instance_id
      HAVING COUNT(*) > 1
      ORDER BY file_name, prosbc_instance_id
    `, { type: database.sequelize.QueryTypes.SELECT });

    console.log(`Found ${duplicates.length} duplicate file combinations to clean up`);

    let totalDeleted = 0;

    for (const dup of duplicates) {
      console.log(`Cleaning duplicates for: ${dup.file_name} in ${dup.prosbc_instance_id}`);

      // Get all records for this combination, ordered by updatedAt desc
      const records = await ProSBCDMFile.findAll({
        where: {
          file_name: dup.file_name,
          prosbc_instance_id: dup.prosbc_instance_id
        },
        order: [['updatedAt', 'DESC']]
      });

      // Keep the first (most recent) record, delete the rest
      if (records.length > 1) {
        const recordsToDelete = records.slice(1);
        const idsToDelete = recordsToDelete.map(r => r.id);

        await ProSBCDMFile.destroy({
          where: {
            id: idsToDelete
          }
        });

        console.log(`  Deleted ${recordsToDelete.length} duplicate records, kept ID: ${records[0].id}`);
        totalDeleted += recordsToDelete.length;
      }
    }

    console.log(`✅ Cleanup completed! Deleted ${totalDeleted} duplicate records.`);
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to clean up duplicates:', error);
    process.exit(1);
  }
})();
