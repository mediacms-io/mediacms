import axios from 'axios';
import { csrfToken } from '../helpers/';
import { config as mediacmsConfig } from '../settings/config.js';

function baseUrl() {
  return mediacmsConfig(window.MediaCMS).api.migrations;
}

function postConfig() {
  return { headers: { 'X-CSRFToken': csrfToken() } };
}

export function listMigrations() {
  return axios.get(baseUrl() + '/');
}

export function getMigration(id) {
  return axios.get(baseUrl() + '/' + id + '/');
}

export function createMigration(payload) {
  return axios.post(baseUrl() + '/', payload, postConfig());
}

export function updateMigration(id, payload) {
  return axios.put(baseUrl() + '/' + id + '/', payload, postConfig());
}

export function deleteMigration(id) {
  return axios.delete(baseUrl() + '/' + id + '/', postConfig());
}

export function checkConnection(payload) {
  return axios.post(baseUrl() + '/check_connection/', payload, postConfig());
}

export function checkSavedConnection(id, options) {
  return axios.post(baseUrl() + '/' + id + '/check_connection/', { options: options || {} }, postConfig());
}

export function controlMigration(id, action) {
  return axios.post(baseUrl() + '/' + id + '/' + action + '/', {}, postConfig());
}

export function listSourceCategories(payload) {
  return axios.post(baseUrl() + '/source_categories/', payload, postConfig());
}

export function listSavedSourceCategories(id) {
  return axios.post(baseUrl() + '/' + id + '/source_categories/', {}, postConfig());
}

export function listSourceRoles(payload) {
  return axios.post(baseUrl() + '/source_roles/', payload, postConfig());
}

export function listSavedSourceRoles(id) {
  return axios.post(baseUrl() + '/' + id + '/source_roles/', {}, postConfig());
}

export function getProgress(id) {
  return axios.get(baseUrl() + '/' + id + '/progress/');
}

export function getRecords(id, params) {
  return axios.get(baseUrl() + '/' + id + '/records/', { params: params || {} });
}
