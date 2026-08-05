import { 
  collection as fb_collection, 
  doc as fb_doc, 
  getDoc as fb_getDoc, 
  getDocs as fb_getDocs, 
  addDoc as fb_addDoc, 
  updateDoc as fb_updateDoc, 
  deleteDoc as fb_deleteDoc, 
  query as fb_query, 
  where as fb_where, 
  orderBy as fb_orderBy, 
  onSnapshot as fb_onSnapshot,
  Timestamp,
  setDoc as fb_setDoc,
  serverTimestamp,
  getDocFromServer,
  limit as fb_limit
} from 'firebase/firestore';
import axios from 'axios';

// Re-export standard helpers that do not require changes
export { Timestamp, serverTimestamp, getDocFromServer };

const QUERY_METADATA = Symbol('queryMetadata');

export function collection(dbInstance: any, path: string, ...segments: string[]) {
  const fullPath = [path, ...segments].filter(Boolean).join('/');
  if (!fb_collection) return { path: fullPath } as any;
  const ref = fb_collection(dbInstance, path, ...segments);
  (ref as any)[QUERY_METADATA] = {
    path: fullPath,
    wheres: [],
    orderByField: undefined,
    orderDirection: undefined,
    limitVal: undefined
  };
  return ref;
}

export function doc(dbInstance: any, path: string, ...segments: string[]) {
  const fullPath = segments.length > 0 ? [path, ...segments].join('/') : path;
  let finalPath = "";
  if (dbInstance && typeof dbInstance === "object" && 'path' in dbInstance) {
    finalPath = [dbInstance.path, path, ...segments].filter(Boolean).join('/');
  } else {
    finalPath = fullPath;
  }
  const ref = fb_doc(dbInstance, path, ...segments);
  (ref as any)[QUERY_METADATA] = {
    path: finalPath,
    wheres: [],
    orderByField: undefined,
    orderDirection: undefined,
    limitVal: undefined
  };
  return ref;
}

export function where(field: string, op: any, value: any) {
  const realC = fb_where(field, op, value);
  (realC as any)._meta = { type: 'where', field, op, value };
  return realC;
}

export function orderBy(field: string, direction: any = 'asc') {
  const realC = fb_orderBy(field, direction);
  (realC as any)._meta = { type: 'orderBy', field, direction };
  return realC;
}

export function limit(n: number) {
  const realC = fb_limit(n);
  (realC as any)._meta = { type: 'limit', limit: n };
  return realC;
}

export function query(queryInstance: any, ...constraints: any[]) {
  const q = fb_query(queryInstance, ...constraints);
  const parentMeta = queryInstance[QUERY_METADATA] || { wheres: [] };
  const meta = {
    path: parentMeta.path || queryInstance.path || "",
    wheres: [...(parentMeta.wheres || [])],
    orderByField: parentMeta.orderByField,
    orderDirection: parentMeta.orderDirection,
    limitVal: parentMeta.limitVal
  };
  for (const c of constraints) {
    const detail = c?._meta;
    if (detail) {
      if (detail.type === 'where') {
        meta.wheres.push({ field: detail.field, op: detail.op, value: detail.value });
      } else if (detail.type === 'orderBy') {
        meta.orderByField = detail.field;
        meta.orderDirection = detail.direction;
      } else if (detail.type === 'limit') {
        meta.limitVal = detail.limit;
      }
    }
  }
  (q as any)[QUERY_METADATA] = meta;
  return q;
}

export async function getDocs(queryInstance: any) {
  try {
    return await fb_getDocs(queryInstance);
  } catch (error: any) {
    console.warn("Firestore client-side getDocs failed. Attempting secure backend REST fallback proxy...", error);
    const meta = queryInstance[QUERY_METADATA] || {};
    const path = meta.path || queryInstance.path || "";
    
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "list",
        path,
        wheres: meta.wheres,
        orderByField: meta.orderByField,
        orderDirection: meta.orderDirection,
        limitVal: meta.limitVal
      });
      
      if (response.data && response.data.docs) {
        const docs = response.data.docs.map((d: any) => ({
          id: d.id,
          data: () => d.data,
          exists: () => true
        }));
        return {
          docs,
          empty: docs.length === 0,
          size: docs.length,
          forEach: (cb: any) => docs.forEach(cb)
        };
      }
    } catch (fallbackError) {
      console.error("Firestore client fallback getDocs failed:", fallbackError);
    }
    throw error;
  }
}

export async function getDoc(docRef: any) {
  try {
    return await fb_getDoc(docRef);
  } catch (error: any) {
    console.warn("Firestore client-side getDoc failed. Attempting secure backend REST fallback proxy...", error);
    const meta = docRef[QUERY_METADATA] || {};
    const path = meta.path || docRef.path || "";
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "get",
        path
      });
      if (response.data) {
        return {
          id: response.data.id || docRef.id,
          exists: () => response.data.exists,
          data: () => response.data.data
        };
      }
    } catch (fallbackError) {
      console.error("Firestore client fallback getDoc failed:", fallbackError);
    }
    throw error;
  }
}

export async function addDoc(colRef: any, data: any) {
  try {
    return await fb_addDoc(colRef, data);
  } catch (error: any) {
    console.warn("Firestore client-side addDoc failed. Attempting secure backend REST fallback proxy...", error);
    const meta = colRef[QUERY_METADATA] || {};
    const path = meta.path || colRef.path || "";
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "add",
        path,
        data
      });
      if (response.data && response.data.id) {
        return { id: response.data.id };
      }
    } catch (fallbackError) {
      console.error("Firestore client fallback addDoc failed:", fallbackError);
    }
    throw error;
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    return await fb_updateDoc(docRef, data);
  } catch (error: any) {
    console.warn("Firestore client-side updateDoc failed. Attempting secure backend REST fallback proxy...", error);
    const meta = docRef[QUERY_METADATA] || {};
    const path = meta.path || docRef.path || "";
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "update",
        path,
        data
      });
      return response.data;
    } catch (fallbackError) {
      console.error("Firestore client fallback updateDoc failed:", fallbackError);
    }
    throw error;
  }
}

export async function setDoc(docRef: any, data: any, options?: any) {
  try {
    return await fb_setDoc(docRef, data, options);
  } catch (error: any) {
    console.warn("Firestore client-side setDoc failed. Attempting secure backend REST fallback proxy...", error);
    const meta = docRef[QUERY_METADATA] || {};
    const path = meta.path || docRef.path || "";
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "set",
        path,
        data
      });
      return response.data;
    } catch (fallbackError) {
      console.error("Firestore client fallback setDoc failed:", fallbackError);
    }
    throw error;
  }
}

export async function deleteDoc(docRef: any) {
  try {
    return await fb_deleteDoc(docRef);
  } catch (error: any) {
    console.warn("Firestore client-side deleteDoc failed. Attempting secure backend REST fallback proxy...", error);
    const meta = docRef[QUERY_METADATA] || {};
    const path = meta.path || docRef.path || "";
    try {
      const response = await axios.post("/api/firestore/fallback", {
        action: "delete",
        path
      });
      return response.data;
    } catch (fallbackError) {
      console.error("Firestore client fallback deleteDoc failed:", fallbackError);
    }
    throw error;
  }
}

export function onSnapshot(queryRef: any, onNext: any, onError?: any) {
  let unsub = () => {};
  const isDocument = queryRef?.type === 'document';
  try {
    unsub = fb_onSnapshot(queryRef, onNext, async (error: any) => {
      console.warn("onSnapshot failed. Falling back to discrete proxy fetch...", error);
      try {
        const snap = isDocument ? await getDoc(queryRef) : await getDocs(queryRef);
        onNext(snap);
        const intervalId = setInterval(async () => {
          try {
            const snapPool = isDocument ? await getDoc(queryRef) : await getDocs(queryRef);
            onNext(snapPool);
          } catch (pollErr) {
            console.warn("Polling fallback failed:", pollErr);
          }
        }, 10000);
        
        unsub = () => {
          clearInterval(intervalId);
        };
      } catch (fallbackErr) {
        if (onError) onError(fallbackErr);
      }
    });
  } catch (outerErr: any) {
    console.warn("Immediate crash on onSnapshot. Falling back to discrete proxy fetch:", outerErr);
    let intervalId: any;
    (async () => {
      try {
        const snap = isDocument ? await getDoc(queryRef) : await getDocs(queryRef);
        onNext(snap);
        intervalId = setInterval(async () => {
          try {
            const snapPool = isDocument ? await getDoc(queryRef) : await getDocs(queryRef);
            onNext(snapPool);
          } catch (pollErr) {
            console.warn("Polling fallback failed:", pollErr);
          }
        }, 10000);
      } catch (fallbackErr) {
        if (onError) onError(fallbackErr);
      }
    })();
    unsub = () => {
      if (intervalId) clearInterval(intervalId);
    };
  }
  return unsub;
}
