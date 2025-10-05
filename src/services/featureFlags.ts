import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

type Flags = { 
  explore_stacks?: boolean;
  [key: string]: boolean | undefined;
};

let cache: Flags = {};

export async function getFlags(): Promise<Flags> {
  if (Object.keys(cache).length) return cache;
  try {
    const snap = await getDoc(doc(db, "app/config", "featureFlags"));
    cache = (snap.exists() ? (snap.data() as Flags) : {});
  } catch { 
    cache = {}; 
  }
  return cache;
}
