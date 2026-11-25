import "./style.css";
import { startApp } from "./app";

startApp();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* install still works from the manifest on some browsers */
    });
  });
}
