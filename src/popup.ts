import { configSchema, getConfig, isConfigKey, saveConfig } from "./config";

class PopupManager {
  private configForm: HTMLFormElement;
  private saveButton: HTMLButtonElement;
  private statusElement: HTMLElement;

  constructor() {
    this.configForm = document.getElementById("config") as HTMLFormElement;
    this.saveButton = this.configForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.createStatusElement();
    this.init();
  }

  private createStatusElement(): void {
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'status';
    this.statusElement.style.cssText = `
      margin: 10px 5%;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
      display: none;
    `;
    this.configForm.appendChild(this.statusElement);
  }

  private showStatus(message: string, type: 'success' | 'error' = 'success'): void {
    this.statusElement.textContent = message;
    this.statusElement.style.display = 'block';
    this.statusElement.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
    this.statusElement.style.color = type === 'success' ? '#155724' : '#721c24';
    this.statusElement.style.borderColor = type === 'success' ? '#c3e6cb' : '#f5c6cb';
    
    setTimeout(() => {
      this.statusElement.style.display = 'none';
    }, 3000);
  }

  private setLoadingState(loading: boolean): void {
    this.saveButton.disabled = loading;
    this.saveButton.textContent = loading ? 'Saving...' : 'Save';
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await getConfig();
      
      for (const element of this.configForm.querySelectorAll("input, select")) {
        const input = element as HTMLInputElement | HTMLSelectElement;
        const name = input.name;
        
        if (isConfigKey(name) && config[name] !== undefined) {
          input.value = String(config[name]);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showStatus('Failed to load configuration', 'error');
    }
  }

  private async saveConfig(formData: FormData): Promise<void> {
    this.setLoadingState(true);
    
    try {
      const configData = Object.fromEntries(formData.entries());
      const newConfig = configSchema.parse(configData);
      
      await saveConfig(newConfig);
      this.showStatus('Configuration saved successfully!');
      
      // Notify background script of config update
      chrome.runtime.sendMessage({ type: 'config-update' });
    } catch (error) {
      console.error('Failed to save config:', error);
      
      if (error instanceof Error) {
        this.showStatus(`Failed to save: ${error.message}`, 'error');
      } else {
        this.showStatus('Failed to save configuration', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
  }

  private init(): void {
    this.loadConfig();
    
    this.configForm.addEventListener("submit", async (e: SubmitEvent) => {
      e.preventDefault();
      const formData = new FormData(this.configForm);
      await this.saveConfig(formData);
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupManager());
} else {
  new PopupManager();
}
