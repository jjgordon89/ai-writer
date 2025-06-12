import React, { useState, useEffect } from 'react';
import { Database, HardDrive, ArrowRight, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { hybridDataService, DataMigrationStatus } from '../../services/hybridDataService';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';

interface MigrationStatus {
  canMigrate: boolean;
  hasLocalData: boolean;
  hasDatabaseData: boolean;
}

interface HealthStatus {
  localStorage: { status: 'healthy' | 'unhealthy'; details: string };
  database: { status: 'healthy' | 'unhealthy' | 'unavailable'; details: string };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export function DatabaseMigrationPanel() {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<DataMigrationStatus | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { wrapAsync } = useAsyncErrorHandler({ component: 'DatabaseMigrationPanel' });

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    await wrapAsync(async () => {
      setIsLoading(true);
      
      // Initialize hybrid service if not already done
      await hybridDataService.initialize();
      
      const [migration, health] = await Promise.all([
        hybridDataService.getMigrationStatus(),
        hybridDataService.healthCheck()
      ]);
      
      setMigrationStatus(migration);
      setHealthStatus(health);
      setIsLoading(false);
    });
  };

  const handleMigration = async () => {
    await wrapAsync(async () => {
      setIsMigrating(true);
      setMigrationResult(null);
      
      const result = await hybridDataService.migrateToDatabase();
      setMigrationResult(result);
      
      // Reload status after migration
      await loadStatus();
      setIsMigrating(false);
    });
  };

  const handleDatabaseMode = async () => {
    await wrapAsync(async () => {
      hybridDataService.setConfig({ useDatabase: true });
      await loadStatus();
    });
  };

  const handleLocalStorageMode = async () => {
    await wrapAsync(async () => {
      hybridDataService.setConfig({ useDatabase: false });
      await loadStatus();
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600">Checking data storage status...</span>
        </div>
      </div>
    );
  }

  const currentConfig = hybridDataService.getConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Data Storage Management</h2>
        </div>
        
        <p className="text-gray-600 leading-relaxed">
          Manage your data storage between browser localStorage and SQLite database. 
          The database provides better performance, reliability, and advanced features.
        </p>
      </div>

      {/* Health Status */}
      {healthStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <span>Storage Health Status</span>
            {healthStatus.overall === 'healthy' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {healthStatus.overall === 'degraded' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            {healthStatus.overall === 'unhealthy' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* localStorage Status */}
            <div className={`p-4 rounded-lg border-2 ${
              healthStatus.localStorage.status === 'healthy' 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <HardDrive className="w-5 h-5" />
                <span className="font-medium">Browser Storage</span>
                {healthStatus.localStorage.status === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <p className="text-sm text-gray-600">{healthStatus.localStorage.details}</p>
            </div>

            {/* Database Status */}
            <div className={`p-4 rounded-lg border-2 ${
              healthStatus.database.status === 'healthy' 
                ? 'border-green-200 bg-green-50' 
                : healthStatus.database.status === 'unavailable'
                ? 'border-gray-200 bg-gray-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-5 h-5" />
                <span className="font-medium">SQLite Database</span>
                {healthStatus.database.status === 'healthy' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {healthStatus.database.status === 'unavailable' && <AlertTriangle className="w-4 h-4 text-gray-500" />}
                {healthStatus.database.status === 'unhealthy' && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              <p className="text-sm text-gray-600">{healthStatus.database.details}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Configuration</h3>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Primary Storage:</span>
              <div className="mt-1">
                {currentConfig.useDatabase ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Database className="w-3 h-3 mr-1" />
                    SQLite Database
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <HardDrive className="w-3 h-3 mr-1" />
                    Browser Storage
                  </span>
                )}
              </div>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Fallback:</span>
              <div className="mt-1">
                {currentConfig.fallbackToLocalStorage ? (
                  <span className="text-green-600">Enabled</span>
                ) : (
                  <span className="text-gray-500">Disabled</span>
                )}
              </div>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Migration Mode:</span>
              <div className="mt-1">
                {currentConfig.migrationMode ? (
                  <span className="text-yellow-600">Active</span>
                ) : (
                  <span className="text-gray-500">Inactive</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Panel */}
      {migrationStatus && healthStatus?.database.status === 'healthy' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Data Migration</h3>
          
          {migrationStatus.hasLocalData && !migrationStatus.hasDatabaseData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">Migration Available</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    You have projects stored in browser localStorage that can be migrated to the database 
                    for better performance and reliability.
                  </p>
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={handleMigration}
                  disabled={isMigrating}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isMigrating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Migrating...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Migrate to Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {migrationStatus.hasDatabaseData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-800">Database Active</h4>
                  <p className="text-sm text-green-700">
                    Your projects are stored in the SQLite database. You're getting the best performance and features.
                  </p>
                </div>
              </div>
            </div>
          )}

          {migrationResult && (
            <div className={`rounded-lg p-4 mb-4 ${
              migrationResult.isComplete && migrationResult.errors.length === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h4 className="font-medium mb-2">Migration Results</h4>
              <div className="text-sm space-y-1">
                <p>Total projects: {migrationResult.totalProjects}</p>
                <p>Successfully migrated: {migrationResult.migratedProjects}</p>
                {migrationResult.errors.length > 0 && (
                  <div>
                    <p className="text-red-600">Errors ({migrationResult.errors.length}):</p>
                    <ul className="list-disc list-inside text-red-600 ml-2">
                      {migrationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Options */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-lg font-medium text-gray-900">Advanced Options</h3>
          <ArrowRight className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleDatabaseMode}
                disabled={!healthStatus || healthStatus.database.status !== 'healthy'}
                className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Database className="w-4 h-4" />
                <span>Use Database Mode</span>
              </button>
              
              <button
                onClick={handleLocalStorageMode}
                className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <HardDrive className="w-4 h-4" />
                <span>Use Browser Storage Mode</span>
              </button>
            </div>
            
            <button
              onClick={loadStatus}
              className="flex items-center space-x-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Status</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
