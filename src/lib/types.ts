export type RadarDirection = 'FRONT_FACING' | 'REAR_FACING';
export type RadarType = 'FIXED' | 'MOBILE' | 'AVERAGE_SPEED' | 'RED_LIGHT';
export type RadarStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE';
export type Emirate = 'Abu Dhabi' | 'Dubai' | 'Sharjah' | 'Ajman' | 'Umm Al Quwain' | 'Ras Al Khaimah' | 'Fujairah';

export interface Radar {
  id: string;
  latitude: number;
  longitude: number;
  roadName: string;
  emirate: Emirate;
  direction: RadarDirection;
  speedLimit: number;
  radarType: RadarType;
  status: RadarStatus;
  headingDegrees: number;
  lastVerified: string | null;
  notes: string;
}

export type AlertZone = 'none' | 'awareness' | 'alert' | 'countdown' | 'clear';

export interface RadarAlert {
  radar: Radar;
  distance: number; // meters
  zone: AlertZone;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null; // m/s
  accuracy: number;
  timestamp: number;
}
