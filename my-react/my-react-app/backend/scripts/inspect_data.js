const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "ebrs_system",
  port: process.env.DB_PORT || 3307,
};

async function inspect() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to database.");

    const [models] = await connection.execute("SELECT * FROM TB_M_Model");
    console.log("--- TB_M_Model (All) ---");
    console.table(models);


  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (connection) await connection.end();
  }
}

inspect();
