import type { GameId, PatientProfileMetrics } from '../services/adaptive/types';
import { readPatientProfileMetrics as readStoredPatientProfileMetrics } from './sessions';

export function readPatientProfileMetrics(patientId: string, gameId?: GameId, calculatedAt?: number): Promise<PatientProfileMetrics> {
  return readStoredPatientProfileMetrics(patientId, gameId, calculatedAt);
}