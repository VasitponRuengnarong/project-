const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "ebrs_system",
  port: process.env.DB_PORT || 3307,
};

async function updateModelIDs() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to database.");

    // Fetch devices without ModelID or with ModelID = 0 (if that's a thing)
    // We purposefully fetch ALL devices to re-check if any can be improved or if NULLs exist
    const [devices] = await connection.execute("SELECT DVID, DeviceName, ModelID FROM TB_T_Device");
    const [models] = await connection.execute("SELECT * FROM TB_M_Model");

    console.log(`Found ${devices.length} devices and ${models.length} models.`);

    let validUpdates = 0;
    let unmatched = 0;
    
    // Helper to tokenize string for smarter matching
    const tokenize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, " ").split(" ").filter(t => t.length > 1);

    for (const device of devices) {
        if (device.ModelID) continue; // Skip if already has a model (or we can decide to overwrite if we want to be aggressive)

        let bestMatch = null;
        const dNameLower = device.DeviceName.toLowerCase();

        // Strategy 1: Exact Match (Case Insensitive)
        let match = models.find(m => m.ModelName.toLowerCase() === dNameLower);
        
        // Strategy 2: Model Name is contained in Device Name
        if (!match) {
            match = models.find(m => dNameLower.includes(m.ModelName.toLowerCase()));
        }

        // Strategy 3: Device Name is contained in Model Name
        if (!match) {
            match = models.find(m => m.ModelName.toLowerCase().includes(dNameLower));
        }

        // Strategy 4: Token Overlap (at least 2 tokens must match if available, or all if short)
        if (!match) {
             const dTokens = tokenize(device.DeviceName);
             
             for (const m of models) {
                 const mTokens = tokenize(m.ModelName);
                 const intersection = dTokens.filter(t => mTokens.includes(t));
                 
                 // If model name is short (e.g. "Canon R5"), we need high overlap.
                 // Heuristic: If 75% of model tokens are in device name
                 if (intersection.length >= Math.ceil(mTokens.length * 0.75) && intersection.length > 0) {
                     match = m;
                     break; // Take first good match
                 }
             }
        }

        if (match) {
            console.log(`[UPDATE] Device '${device.DeviceName}' -> Model '${match.ModelName}' (ID: ${match.ModelID})`);
            await connection.execute("UPDATE TB_T_Device SET ModelID = ? WHERE DVID = ?", [match.ModelID, device.DVID]);
            validUpdates++;
        } else {
            console.log(`[UNMATCHED] Device '${device.DeviceName}'`);
            unmatched++;
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Updated: ${validUpdates}`);
    console.log(`Unmatched: ${unmatched}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (connection) await connection.end();
  }
}

updateModelIDs();
