import React, { createContext, useContext, useState } from 'react';

const BackgroundTasksContext = createContext();

export const BackgroundTasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);

  const startTask = (title, message, progress = 0) => {
    const id = Date.now().toString();
    setTasks(prev => [...prev, { id, title, message, progress, status: 'running' }]);
    return id;
  };

  const updateTask = (taskId, updates) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const completeTask = (taskId, message) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, status: 'completed', message } : task
    ));
    // Remove after a delay
    setTimeout(() => {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }, 5000);
  };

  const failTask = (taskId, message) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, status: 'failed', message } : task
    ));
    // Remove after a delay
    setTimeout(() => {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }, 10000);
  };

  const dismissTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  return (
    <BackgroundTasksContext.Provider value={{ tasks, startTask, updateTask, completeTask, failTask, dismissTask }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
};

export const useBackgroundTasks = () => useContext(BackgroundTasksContext);