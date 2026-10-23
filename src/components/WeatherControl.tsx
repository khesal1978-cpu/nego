import React, { useSyncExternalStore } from 'react';
import { CloudSun } from 'lucide-react';
import { getWeather, setWeather, subscribeWeather } from '../three/weather';
import './weatherControl.css';

export function WeatherControl() {
  const weather = useSyncExternalStore(subscribeWeather, getWeather, getWeather);
  const enabled = weather !== 'normal';
  return <button className="weather-toggle" aria-label="Automatic weather" aria-pressed={enabled} title={`Automatic weather ${enabled ? 'on' : 'off'}`} onClick={() => setWeather(enabled ? 'normal' : 'auto')}><CloudSun size={15} /><span className="weather-status" aria-hidden="true" /></button>;
}
