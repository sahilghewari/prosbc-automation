
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mariadb',
    port: process.env.DB_PORT || 3306,
    logging: false,
    dialectOptions: {
      connectTimeout: 10000 // 10 seconds
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
