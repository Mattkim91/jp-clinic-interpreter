import "./style.css";
import { startApp } from "./app";

startApp();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const scopeUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    const swUrl = new URL("sw.js", scopeUrl);
    navigator.serviceWorker.register(swUrl.href, { scope: scopeUrl.href }).catch(() => {
      navigator.serviceWorker.register(swUrl.href).catch(() => {
        /* install still works from the manifest on some browsers */
      });
    });
  });
}
