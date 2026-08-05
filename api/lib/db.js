import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let db = null;

export function getDb() {
  if (db) return db;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      
      let app;
      if (getApps().length === 0) {
        app = initializeApp({
          projectId: config.projectId,
        });
      } else {
        app = getApps()[0];
      }
      
      const dbId = config.firestoreDatabaseId;
      if (dbId && dbId !== "(default)") {
        db = getFirestore(app, dbId);
      } else {
        db = getFirestore(app);
      }
    }
  } catch (error) {
    console.error("Error initializing Firestore in Vercel handler:", error);
  }
  return db;
}

export async function getGoogleMapsKey() {
  const firestoreDb = getDb();
  let storedKey = "";

  if (firestoreDb) {
    try {
      const sysSnap = await firestoreDb.collection("system_settings").doc("integrations").get();
      if (sysSnap.exists) {
        storedKey = sysSnap.data()?.googleMapsPlatformKey || "";
      }
    } catch (e) {
      console.warn("Could not read Maps key from system_settings/integrations:", e);
    }

    if (!storedKey) {
      try {
        const legacySnap = await firestoreDb.collection("configs").doc("google_maps").get();
        if (legacySnap.exists) {
          storedKey = legacySnap.data()?.key || "";
        }
      } catch (e) {
        console.warn("Could not read Maps key from legacy configs/google_maps:", e);
      }
    }
  }

  // Backup file check
  if (!storedKey) {
    try {
      const localPath = path.join(process.cwd(), "google_maps_key_config.json");
      if (fs.existsSync(localPath)) {
        const localData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
        storedKey = localData.key || "";
      }
    } catch (e) {
      console.warn("Could not read Maps key from local file:", e);
    }
  }

  return storedKey || process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
}

export async function getSmtpConfig() {
  const firestoreDb = getDb();
  let smtpData = null;

  if (firestoreDb) {
    try {
      const docSnap = await firestoreDb.collection("configs").doc("smtp").get();
      if (docSnap.exists) {
        smtpData = docSnap.data();
      }
    } catch (err) {
      console.warn("Could not read SMTP config from DB:", err);
    }
  }

  const localSmtpPath = path.join(process.cwd(), "smtp_config.json");
  if (!smtpData && fs.existsSync(localSmtpPath)) {
    try {
      smtpData = JSON.parse(fs.readFileSync(localSmtpPath, "utf-8"));
    } catch (err) {
      console.warn("Error reading local SMTP config file:", err);
    }
  }

  if (!smtpData) {
    if (process.env.SMTP_HOST) {
      return {
        host: process.env.SMTP_HOST || "",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secureType: process.env.SMTP_SECURE_TYPE || "TLS",
        emailRemetente: process.env.SMTP_EMAIL_REMETENTE || "",
        nomeRemetente: process.env.SMTP_NOME_REMETENTE || "",
        usuario: process.env.SMTP_USUARIO || "",
        senha: process.env.SMTP_SENHA || "",
        configured: true
      };
    }
    return null;
  }

  return {
    host: smtpData.host || "",
    port: parseInt(smtpData.port, 10) || 587,
    secureType: smtpData.secureType || "TLS",
    emailRemetente: smtpData.emailRemetente || "",
    nomeRemetente: smtpData.nomeRemetente || "",
    usuario: smtpData.usuario || "",
    senha: smtpData.senha || "",
    configured: !!(smtpData.host && smtpData.usuario && smtpData.senha)
  };
}

export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
