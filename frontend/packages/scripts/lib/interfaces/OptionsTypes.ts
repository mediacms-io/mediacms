import { ConfigType } from '../config';

export interface DevOptionsType {
	env: string,
	host: string,
	port: number,
	config: ConfigType,
}

export interface BuildOptionsType {
	env: string,
	config: ConfigType,
}

export interface AnalyzerOptionsType {
	env: string,
	host: string,
	port: number,
	mode: string,
	config: ConfigType,
}