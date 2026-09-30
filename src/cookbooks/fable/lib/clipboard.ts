/**
 * Copy-to-clipboard without a static import: the package is installed, but
 * until the fresh dev-client build lands the native module is absent, so
 * this resolves false and the UI explains instead of crashing.
 *
 * The module ID is built at runtime on purpose — Metro statically resolves
 * require("expo-clipboard") at bundle time and would fail while the package
 * is intentionally not installed.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const req = (globalThis as { require?: (id: string) => unknown }).require;
    if (typeof req !== "function") return false;
    const moduleId = ["expo", "clipboard"].join("-");
    const Clipboard = req(moduleId) as {
      setStringAsync: (value: string) => Promise<void>;
    };
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
