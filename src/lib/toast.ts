export function showToast(message: string, type: "success" | "warning" = "success"): void {
  // Remove any existing toast
  const existing = document.getElementById("gh-extra-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "gh-extra-toast";
  toast.textContent = message;

  const bg = type === "success" ? "#1a7f37" : "#9a6700";

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: bg,
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    zIndex: "99999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s ease",
    opacity: "1",
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
