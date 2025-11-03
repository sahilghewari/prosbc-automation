import React from 'react';
import { useBackgroundTasks } from '../contexts/BackgroundTasksContext';

function BackgroundTasksPopup() {
  const { tasks, dismissTask } = useBackgroundTasks();

  const activeTasks = tasks.filter(task => task.status === 'running' || task.status === 'completed' || task.status === 'failed');

  if (activeTasks.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {activeTasks.map(task => (
        <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white mb-2">{task.title}</div>
              <div className="text-xs text-gray-300 mb-2 break-words">{task.message}</div>
              {task.status === 'running' && task.progress && (
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>
              )}
              {task.status === 'running' && task.progress && (
                <div className="text-xs text-gray-400 mb-2">
                  {task.progress}% complete
                </div>
              )}
              {task.status === 'completed' && (
                <div className="text-xs text-green-400">✓ Completed</div>
              )}
              {task.status === 'failed' && (
                <div className="text-xs text-red-400">✗ Failed</div>
              )}
              
              {/* Show additional details for replace-all tasks */}
              {task.title === 'Replace All Data' && task.details && (
                <div className="mt-2 text-xs text-gray-400 border-t border-gray-700 pt-2">
                  <div className="space-y-1">
                    {task.details.totalInstances && (
                      <div>Instances: {task.details.processedInstances || 0}/{task.details.totalInstances}</div>
                    )}
                    {task.details.totalFiles && (
                      <div>Files: {task.details.processedFiles || 0}/{task.details.totalFiles}</div>
                    )}
                    {task.details.currentOperation && (
                      <div className="text-blue-300 truncate">{task.details.currentOperation}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {(task.status === 'completed' || task.status === 'failed') && (
              <button
                onClick={() => dismissTask(task.id)}
                className="text-gray-400 hover:text-white transition-colors ml-2 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default BackgroundTasksPopup;