const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "ebrs_system",
  port: process.env.DB_PORT || 3306,
};

async function deduplicateTable(connection, tableName, idColumn, nameColumn, fkColumn) {
  console.log(`Processing ${tableName}...`);

  // Find duplicates
  const [duplicates] = await connection.execute(
    `SELECT ${nameColumn}, GROUP_CONCAT(${idColumn}) as ids 
     FROM ${tableName} 
     GROUP BY ${nameColumn} 
     HAVING COUNT(*) > 1`
  );

  if (duplicates.length === 0) {
    console.log(`  No duplicates found in ${tableName}.`);
  } else {
    for (const row of duplicates) {
      const ids = row.ids.split(",").map(Number).sort((a, b) => a - b);
      const keepId = ids[0];
      const removeIds = ids.slice(1);

      console.log(`  Merging ${row[nameColumn]}: Keeping ${keepId}, Removing ${removeIds.join(", ")}`);

      // Update Foreign Keys in TB_T_Device
      // Only do this if we have a valid Foreign Key column to update
      if (fkColumn) {
         // Check if fkColumn exists in TB_T_Device first
         try {
            await connection.execute(`UPDATE TB_T_Device SET ${fkColumn} = ? WHERE ${fkColumn} IN (${removeIds.join(",")})`, [keepId]);
            console.log(`    Updated TB_T_Device references.`);
         } catch (err) {
             console.log(`    Skipping FK update for ${fkColumn} (column might not exist or error):`, err.message);
         }
      }

      // Delete duplicates
      await connection.execute(
        `DELETE FROM ${tableName} WHERE ${idColumn} IN (${removeIds.join(",")})`
      );
      console.log(`    Deleted duplicate rows.`);
    }
  }

  // Add UNIQUE constraint if not exists
  try {
     // Check if index exists
     const [indices] = await connection.execute(`SHOW INDEX FROM ${tableName} WHERE Key_name = 'unique_${nameColumn}'`);
     if (indices.length === 0) {
        // Try adding unique constraint. 
        // Note: constraint name usually matches index name in MySQL if not specified, 
        // but let's be explicit with index name to avoid errors if multiple exist.
        await connection.execute(`ALTER TABLE ${tableName} ADD UNIQUE INDEX unique_${nameColumn} (${nameColumn})`);
        console.log(`  Added UNIQUE constraint to ${tableName}.${nameColumn}`);
     } else {
        console.log(`  UNIQUE constraint already exists on ${tableName}.${nameColumn}`);
     }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        console.error(`  Failed to add UNIQUE constraint: Duplicate entries still exist!`);
    } else {
        console.error(`  Error adding constraint:`, err.message);
    }
  }
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to database.");

    await deduplicateTable(connection, "TB_M_Category", "CategoryID", "CategoryName", "CategoryID");
    await deduplicateTable(connection, "TB_M_Brand", "BrandID", "BrandName", "BrandID");
    await deduplicateTable(connection, "TB_M_Type", "TypeID", "TypeName", "TypeID");

    console.log("Deduplication complete.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (connection) await connection.end();
  }
}

main();
