// Thin promise wrappers around chrome.storage.sync, shared by the feature
// modules' store.js files. No DOM code here.

export function syncGet(key, defaultValue) {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [key]: defaultValue }, (data) => resolve(data[key]));
  });
}

export function syncSet(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Fires in every open new-tab page, including the one that made the change.
export function syncOnChanged(key, callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[key]) {
      callback(changes[key].newValue);
    }
  });
}
