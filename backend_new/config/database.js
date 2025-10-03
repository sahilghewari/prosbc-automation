import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mariadb',
    port: process.env.DB_PORT || 3306,
    logging: false,
    dialectOptions: {
      connectTimeout: 30000, // 30 seconds
      // Disable GSSAPI and prefer standard authentication
      permitSetMultiParamEntries: true,
      // Force use of mysql_native_password or caching_sha2_password
      authPlugins: {
        mysql_native_password: () => () => Buffer.from([])
      },
      // Additional connection options to avoid GSSAPI
      skipSetTimezone: true,
      charset: 'utf8mb4'
    }
  }
);

const database = {
  sequelize,
  connect: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Connected to MariaDB!');
    } catch (err) {
      console.error('❌ Unable to connect to MariaDB:', err);
      throw err;
    }
  },
  disconnect: async () => {
    await sequelize.close();
  },
};

export default database;
