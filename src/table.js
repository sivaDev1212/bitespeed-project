const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://bitespeed_test_db_user:f5bCAV1MhZyZeFWiDrDCNilxnwHO7G5h@dpg-d123h2mmcj7s73eudr60-a.singapore-postgres.render.com/bitespeed_test_db",
  ssl: {
    rejectUnauthorized: false, // required for Render PostgreSQL
  },
});

const createTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS Contact (
      id SERIAL PRIMARY KEY,
      phoneNumber VARCHAR(20),
      email VARCHAR(255),
      linkedId INT,
      linkPrecedence VARCHAR(10) CHECK (linkPrecedence IN ('primary', 'secondary')),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log("✅ Contact table created or already exists");
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
  } finally {
    await pool.end();
  }
};

createTable();
