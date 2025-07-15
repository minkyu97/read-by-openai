import React, { useState, useEffect, useCallback } from 'react';
import { configSchema, getConfig, saveConfig, isConfigKey, type Config } from '../config';

interface StatusMessage {
  message: string;
  type: 'success' | 'error';
}

const ConfigForm: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    apiKey: '',
    model: 'tts-1',
    voice: 'alloy',
    dbName: 'MyDB',
    dbVersion: 1,
    dbStoreName: 'data'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const showStatus = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 3000);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const loadedConfig = await getConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
      showStatus('Failed to load configuration', 'error');
    }
  }, [showStatus]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const validatedConfig = configSchema.parse(config);
      await saveConfig(validatedConfig);
      showStatus('Configuration saved successfully!');
      
      // Notify background script of config update
      chrome.runtime.sendMessage({ type: 'config-update' });
    } catch (error) {
      console.error('Failed to save config:', error);
      
      if (error instanceof Error) {
        showStatus(`Failed to save: ${error.message}`, 'error');
      } else {
        showStatus('Failed to save configuration', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [config, showStatus]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (isConfigKey(name)) {
      setConfig(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="config-container">
      <h1>Read By AI</h1>
      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label htmlFor="api-key">API Key:</label>
          <input
            type="text"
            name="apiKey"
            id="api-key"
            value={config.apiKey}
            onChange={handleInputChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="voice">Voice:</label>
          <select
            name="voice"
            id="voice"
            value={config.voice}
            onChange={handleInputChange}
          >
            <option value="alloy">Alloy</option>
            <option value="echo">Echo</option>
            <option value="fable">Fable</option>
            <option value="onyx">Onyx</option>
            <option value="nova">Nova</option>
            <option value="shimmer">Shimmer</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="save-button">
          {loading ? 'Saving...' : 'Save'}
        </button>

        {status && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}
      </form>
    </div>
  );
};

export default ConfigForm;