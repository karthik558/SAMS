import { useEffect } from "react";

export default function StartupReady() {
  useEffect(() => {
    const preloader = document.getElementById("preloader");
    if (!preloader || preloader.classList.contains("preloader-hide")) return;

    preloader.classList.add("preloader-hide");
    window.setTimeout(() => preloader.remove(), 200);
  }, []);

  return null;
}
