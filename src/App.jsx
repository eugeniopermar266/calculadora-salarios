import { useState, useEffect, useRef, createContext, useContext } from "react";

// Context para que componentes anidados accedan al usuario actual
const UsuarioContext = createContext(null);
const ProyectoContext = createContext(null); // v45: proyecto activo (id, nombre, productora)

// ─── LOGOS ───────────────────────────────────────────────────────────────────
// Versión neutra: el logo se renderiza como texto "BD PROD TOOLS" inline,
// sin imágenes embebidas. Si quieres recuperar logos personalizados,
// añade aquí las constantes base64 y un componente Logo.

// ─── CALENDARIO LABORAL CANARIAS ────────────────────────────────────────────
// Festivos nacionales + autonómicos. Ordenado por fecha.
// 2026: oficial (BOE-A-2025-21667 y Decreto 61/2025 BOC)
// 2027: pendiente de publicación oficial — añadir aquí cuando se publique.
const FESTIVOS_BILBAO = [
  // 2026 — Decreto 82/2025 (BOPV nº78, 25 abril 2025) + festivos territoriales y locales
  // 8 nacionales
  { fecha: "2026-01-01", nombre: "Año Nuevo",                  tipo: "nacional" },
  { fecha: "2026-01-06", nombre: "Epifanía del Señor",         tipo: "nacional" },
  { fecha: "2026-05-01", nombre: "Fiesta del Trabajo",         tipo: "nacional" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen",      tipo: "nacional" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional de España",  tipo: "nacional" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción",      tipo: "nacional" },
  { fecha: "2026-12-25", nombre: "Natividad del Señor",        tipo: "nacional" },
  // 4 autonómicos País Vasco (sustitutivos de algunos nacionales)
  { fecha: "2026-03-19", nombre: "San José",                   tipo: "autonomico" },
  { fecha: "2026-04-02", nombre: "Jueves Santo",               tipo: "autonomico" },
  { fecha: "2026-04-03", nombre: "Viernes Santo",              tipo: "autonomico" },
  { fecha: "2026-04-06", nombre: "Lunes de Pascua",            tipo: "autonomico" },
  { fecha: "2026-07-25", nombre: "Santiago Apóstol",           tipo: "autonomico" },
  // 1 territorial Bizkaia
  { fecha: "2026-07-31", nombre: "San Ignacio de Loyola",      tipo: "territorial" },
  // 1 local Bilbao
  { fecha: "2026-08-28", nombre: "Semana Grande (Aste Nagusia)", tipo: "local" },
];

// Alias para compatibilidad con el resto del código
const FESTIVOS_CANARIAS = FESTIVOS_BILBAO;

// Devuelve festivos que caen dentro del rango [inicio, fin] (ambos inclusive)
function festivosEnRango(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return [];
  return FESTIVOS_CANARIAS.filter(f => f.fecha >= fechaInicio && f.fecha <= fechaFin);
}

// Devuelve qué mes (índice del desglose) le corresponde a una fecha YYYY-MM-DD
function mesIndexParaFecha(fecha, desglose, fechaInicioStr) {
  if (!desglose || desglose.length === 0) return -1;
  const f = new Date(fecha + "T00:00:00");
  const inicio = new Date(fechaInicioStr + "T00:00:00");
  const mesObjetivo = f.getFullYear() * 12 + f.getMonth();
  const mesInicio   = inicio.getFullYear() * 12 + inicio.getMonth();
  const idx = mesObjetivo - mesInicio;
  return (idx >= 0 && idx < desglose.length) ? idx : -1;
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const DISCLAIMER_ES = "Esta herramienta ha sido disenada y desarrollada por Eugenio Perez. Todos los derechos reservados. Queda prohibida su reproduccion, distribucion, comunicacion publica o uso comercial sin el consentimiento expreso por escrito del autor. El uso no autorizado podra ser perseguido legalmente.";
const DISCLAIMER_EN = "This tool has been designed and developed by Eugenio Perez. All rights reserved. Reproduction, distribution, public communication or commercial use without the express written consent of the author is strictly prohibited. Unauthorized use may be subject to legal action.";
const DISCLAIMER_PDF = "(c) Eugenio Perez - All Rights Reserved - Uso no autorizado prohibido / Unauthorized use forbidden";

const FACTOR_BASE      = 0.89286;
const DIVISOR_VAC      = 11.478452;
const FACTOR_INDEM_DIA = 0.98632;
// v47: Factor indemnización cuando el trabajador es FIJO DISCONTINUO (solo aplica en 40H)
const FACTOR_INDEM_FIJO_DISC = 1.6433333;

// 40H: el salario pactado se descompone en Base + Vac + Indem (suman = pactado)
// Base + Base/11,478452 + (Base/30)*0,98632 = Salario_pactado
// Base * (1 + 1/11,478452 + 0,98632/30) = Salario_pactado
// Base * 1,119996 = Salario_pactado
const DIVISOR_40H_BASE = 1 + 1/DIVISOR_VAC + FACTOR_INDEM_DIA/30; // = 1.119996

// 334 puestos extraídos del Listado COAC Técnicos
const PUESTOS_COAC = [
  { codigo: "003010100", puesto: "DIRECTOR/A 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010101", puesto: "DIRECTOR/A 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010102", puesto: "DIRECTOR/A 3", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010200", puesto: "SCRIPT 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010201", puesto: "SCRIPT 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010300", puesto: "COORDINADOR/A DE DIRECCIÓN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010400", puesto: "PRIMER/A AYTE. DIRECCIÓN 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010401", puesto: "PRIMER/A AYTE. DIRECCIÓN 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010500", puesto: "SEGUNDO/A AYTE DIRECCIÓN RODAJE 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010501", puesto: "SEGUNDO/A AYTE DIRECCIÓN RODAJE 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010502", puesto: "SEGUNDO/A AYTE DIRECCIÓN RODAJE 3", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010600", puesto: "SEGUNDO/A AYTE DIRECCIÓN PAPELES 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010601", puesto: "SEGUNDO/A AYTE DIRECCIÓN PAPELES 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010602", puesto: "SEGUNDO/A AYTE DIRECCIÓN PAPELES 3", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010700", puesto: "AUXILIAR DE DIRECCIÓN 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010701", puesto: "AUXILIAR DE DIRECCIÓN 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010702", puesto: "AUXILIAR DE DIRECCIÓN 3", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010800", puesto: "MERITORIO/A DE DIRECCIÓN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003010900", puesto: "BECARIO/A DE DIRECCIÓN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011000", puesto: "REFUERZOS DE DIRECCIÓN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011100", puesto: "HORAS EXTRAS DIRECCIÓN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011200", puesto: "DIRECTOR/A DE CASTING", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011300", puesto: "AYTE. CASTING", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011400", puesto: "SCOUTING CASTING", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011500", puesto: "COACH 1", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011501", puesto: "COACH 2", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011600", puesto: "AYUDANTE DE COACH", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011700", puesto: "DIBUJANTE DE STORY BOARD", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011800", puesto: "ASISTENTE PERSONAL DEL DIRECTO", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003011900", puesto: "ASISTENTE PERSONAL DE ACTORES/", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003012000", puesto: "HORAS EXTRAS CASTING Y ASISTEN", categoria: "DIRECCIÓN, CASTING Y REDACCION" },
  { codigo: "003020100", puesto: "PRODUCTOR/A EJECUTIVO 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020101", puesto: "PRODUCTOR/A EJECUTIVO 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020102", puesto: "PRODUCTOR/A EJECUTIVO 3", categoria: "PRODUCCIÓN" },
  { codigo: "003020200", puesto: "AYTE. PRODUCCIÓN EJECUTIVA", categoria: "PRODUCCIÓN" },
  { codigo: "003020300", puesto: "DIRECTOR/A DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003020400", puesto: "JEFE/A DE PRODUCCIÓN 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020401", puesto: "JEFE/A DE PRODUCCIÓN 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020500", puesto: "AYTE. DE PRODUCCIÓN 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020501", puesto: "AYTE. DE PRODUCCIÓN 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020502", puesto: "AYTE. DE PRODUCCIÓN 3", categoria: "PRODUCCIÓN" },
  { codigo: "003020503", puesto: "AYTE. DE PRODUCCIÓN 4", categoria: "PRODUCCIÓN" },
  { codigo: "003020504", puesto: "AYTE. DE PRODUCCIÓN 5", categoria: "PRODUCCIÓN" },
  { codigo: "003020505", puesto: "AYTE. DE PRODUCCIÓN 6", categoria: "PRODUCCIÓN" },
  { codigo: "003020600", puesto: "KEY SET 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020601", puesto: "KEY SET 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020700", puesto: "AUXILIAR DE PRODUCCIÓN 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020701", puesto: "AUXILIAR DE PRODUCCIÓN 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020702", puesto: "AUXILIAR DE PRODUCCIÓN 3", categoria: "PRODUCCIÓN" },
  { codigo: "003020703", puesto: "AUXILIAR DE PRODUCCIÓN 4", categoria: "PRODUCCIÓN" },
  { codigo: "003020704", puesto: "AUXILIAR DE PRODUCCIÓN 5", categoria: "PRODUCCIÓN" },
  { codigo: "003020705", puesto: "AUXILIAR DE PRODUCCIÓN 6", categoria: "PRODUCCIÓN" },
  { codigo: "003020706", puesto: "AUXILIAR DE PRODUCCIÓN 7", categoria: "PRODUCCIÓN" },
  { codigo: "003020800", puesto: "JEFE/A  DE TRANSPORTES 1", categoria: "PRODUCCIÓN" },
  { codigo: "003020801", puesto: "JEFE/A  DE TRANSPORTES 2", categoria: "PRODUCCIÓN" },
  { codigo: "003020900", puesto: "COORDINADOR/A DE TRANSPORTES", categoria: "PRODUCCIÓN" },
  { codigo: "003021000", puesto: "CAPITAN/A DE TRANSPORTES", categoria: "PRODUCCIÓN" },
  { codigo: "003021100", puesto: "RUNNERS 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021101", puesto: "RUNNERS 2", categoria: "PRODUCCIÓN" },
  { codigo: "003021102", puesto: "RUNNERS 3", categoria: "PRODUCCIÓN" },
  { codigo: "003021103", puesto: "RUNNERS 4", categoria: "PRODUCCIÓN" },
  { codigo: "003021200", puesto: "OTROS CONDUCTORES 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021201", puesto: "OTROS CONDUCTORES 2", categoria: "PRODUCCIÓN" },
  { codigo: "003021300", puesto: "JEFE/A LOCALIZACIONES 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021301", puesto: "JEFE/A LOCALIZACIONES 2", categoria: "PRODUCCIÓN" },
  { codigo: "003021400", puesto: "COORDINADOR/A DE LOCALIZACIONES", categoria: "PRODUCCIÓN" },
  { codigo: "003021500", puesto: "AYTE DE LOCALIZACIONES 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021501", puesto: "AYTE DE LOCALIZACIONES 2", categoria: "PRODUCCIÓN" },
  { codigo: "003021502", puesto: "AYTE DE LOCALIZACIONES 3", categoria: "PRODUCCIÓN" },
  { codigo: "003021600", puesto: "AUXILIAR DE LOCALIZACIONES 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021601", puesto: "AUXILIAR DE LOCALIZACIONES 2", categoria: "PRODUCCIÓN" },
  { codigo: "003021700", puesto: "PEONES DE LOCALIZACIONES", categoria: "PRODUCCIÓN" },
  { codigo: "003021800", puesto: "COORDINADOR/A DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003021900", puesto: "AYTE. COORDINACIÓN DE PRODUCCIÓN 1", categoria: "PRODUCCIÓN" },
  { codigo: "003021901", puesto: "AYTE. COORDINACIÓN DE PRODUCCIÓN 2", categoria: "PRODUCCIÓN" },
  { codigo: "003022000", puesto: "SECRETARIO/A DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003022100", puesto: "CONTROLLER 1", categoria: "PRODUCCIÓN" },
  { codigo: "003022101", puesto: "CONTROLLER 2", categoria: "PRODUCCIÓN" },
  { codigo: "003022200", puesto: "CONTABLE", categoria: "PRODUCCIÓN" },
  { codigo: "003022300", puesto: "CAJERO/A PAGADOR", categoria: "PRODUCCIÓN" },
  { codigo: "003022400", puesto: "AUXILAR DE CONTROLLER", categoria: "PRODUCCIÓN" },
  { codigo: "003022500", puesto: "PEONES DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003022600", puesto: "MERITORIO/A DE PRODUCCIÓN 1", categoria: "PRODUCCIÓN" },
  { codigo: "003022601", puesto: "MERITORIO/A DE PRODUCCIÓN 2", categoria: "PRODUCCIÓN" },
  { codigo: "003022602", puesto: "MERITORIO/A DE PRODUCCIÓN 3", categoria: "PRODUCCIÓN" },
  { codigo: "003022603", puesto: "MERITORIO/A DE PRODUCCIÓN 4", categoria: "PRODUCCIÓN" },
  { codigo: "003022604", puesto: "MERITORIO/A DE PRODUCCIÓN 5", categoria: "PRODUCCIÓN" },
  { codigo: "003022700", puesto: "BECARIO/A DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003022800", puesto: "REFUERZOS DE PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003022900", puesto: "HORAS EXTRAS PRODUCCIÓN", categoria: "PRODUCCIÓN" },
  { codigo: "003030100", puesto: "DIRECTOR/A DE FOTOGRAFIA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030101", puesto: "DIRECTOR/A DE FOTOGRAFIA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030200", puesto: "DIT 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030201", puesto: "DIT 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030202", puesto: "DIT 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030300", puesto: "OPERADOR/A DE CÁMARA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030301", puesto: "OPERADOR/A DE CÁMARA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030302", puesto: "OPERADOR/A DE CÁMARA 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030400", puesto: "OPERADOR/A DE STEADY 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030401", puesto: "OPERADOR/A DE STEADY 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030402", puesto: "OPERADOR/A DE STEADY 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030500", puesto: "AYUDANTE DE CÁMARA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030501", puesto: "AYUDANTE DE CÁMARA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030502", puesto: "AYUDANTE DE CÁMARA 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030503", puesto: "AYUDANTE DE CÁMARA 4", categoria: "FOTOGRAFÍA" },
  { codigo: "003030504", puesto: "AYUDANTE DE CÁMARA 5", categoria: "FOTOGRAFÍA" },
  { codigo: "003030600", puesto: "AYUDANTE DE STEADY", categoria: "FOTOGRAFÍA" },
  { codigo: "003030700", puesto: "AUXILIAR DE CÁMARA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030701", puesto: "AUXILIAR DE CÁMARA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030702", puesto: "AUXILIAR DE CÁMARA 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030703", puesto: "AUXILIAR DE CÁMARA 4", categoria: "FOTOGRAFÍA" },
  { codigo: "003030704", puesto: "AUXILIAR DE CÁMARA 5", categoria: "FOTOGRAFÍA" },
  { codigo: "003030800", puesto: "VIDEOASSIST 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030801", puesto: "VIDEOASSIST 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003030802", puesto: "VIDEOASSIST 3", categoria: "FOTOGRAFÍA" },
  { codigo: "003030900", puesto: "DATA WRANGLER 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003030901", puesto: "DATA WRANGLER 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003031000", puesto: "FOTO-FIJA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003031001", puesto: "FOTO-FIJA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003031100", puesto: "MERITORIO/A DE CÁMARA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003031101", puesto: "MERITORIO/A DE CÁMARA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003031200", puesto: "BECARIO/A DE CÁMARA 1", categoria: "FOTOGRAFÍA" },
  { codigo: "003031201", puesto: "BECARIO/A DE CÁMARA 2", categoria: "FOTOGRAFÍA" },
  { codigo: "003031300", puesto: "REFUERZOS DE CÁMARA", categoria: "FOTOGRAFÍA" },
  { codigo: "003031400", puesto: "HORAS EXTRAS CÁMARA", categoria: "FOTOGRAFÍA" },
  { codigo: "003040100", puesto: "DISEÑADOR/A DE PROYECTO 1", categoria: "DECORACIÓN" },
  { codigo: "003040101", puesto: "DISEÑADOR/A DE PROYECTO 2", categoria: "DECORACIÓN" },
  { codigo: "003040200", puesto: "PRODUCTION DESIGNER", categoria: "DECORACIÓN" },
  { codigo: "003040300", puesto: "DIRECTOR/A ARTÍSTICO", categoria: "DECORACIÓN" },
  { codigo: "003040400", puesto: "ASISTENTE DE DIRECCIÓN ARTÍSTICO", categoria: "DECORACIÓN" },
  { codigo: "003040500", puesto: "COORDINADOR/A DE ARTE", categoria: "DECORACIÓN" },
  { codigo: "003040600", puesto: "DIBUJANTE", categoria: "DECORACIÓN" },
  { codigo: "003040700", puesto: "DECORADOR/A", categoria: "DECORACIÓN" },
  { codigo: "003040800", puesto: "DISEÑADOR/A GRAFISTA POR ORDENADOR", categoria: "DECORACIÓN" },
  { codigo: "003040900", puesto: "AMBIENTADOR", categoria: "DECORACIÓN" },
  { codigo: "003041000", puesto: "AYUDANTE DE DECORACIÓN 1", categoria: "DECORACIÓN" },
  { codigo: "003041001", puesto: "AYUDANTE DE DECORACIÓN 2", categoria: "DECORACIÓN" },
  { codigo: "003041002", puesto: "AYUDANTE DE DECORACIÓN 3", categoria: "DECORACIÓN" },
  { codigo: "003041003", puesto: "AYUDANTE DE DECORACIÓN 4", categoria: "DECORACIÓN" },
  { codigo: "003041100", puesto: "AUXILIAR DE DECORACIÓN 1", categoria: "DECORACIÓN" },
  { codigo: "003041101", puesto: "AUXILIAR DE DECORACIÓN 2", categoria: "DECORACIÓN" },
  { codigo: "003041102", puesto: "AUXILIAR DE DECORACIÓN 3", categoria: "DECORACIÓN" },
  { codigo: "003041103", puesto: "AUXILIAR DE DECORACIÓN 4", categoria: "DECORACIÓN" },
  { codigo: "003041200", puesto: "ATRECISTA DE RODAJE 1", categoria: "DECORACIÓN" },
  { codigo: "003041201", puesto: "ATRECISTA DE RODAJE 2", categoria: "DECORACIÓN" },
  { codigo: "003041300", puesto: "ATRECISTA DE AVANCE 1", categoria: "DECORACIÓN" },
  { codigo: "003041301", puesto: "ATRECISTA DE AVANCE 2", categoria: "DECORACIÓN" },
  { codigo: "003041302", puesto: "ATRECISTA DE AVANCE 3", categoria: "DECORACIÓN" },
  { codigo: "003041303", puesto: "ATRECISTA DE AVANCE 4", categoria: "DECORACIÓN" },
  { codigo: "003041304", puesto: "ATRECISTA DE AVANCE 5", categoria: "DECORACIÓN" },
  { codigo: "003041400", puesto: "REGIDOR/A", categoria: "DECORACIÓN" },
  { codigo: "003041500", puesto: "AYUDANTE DE REGIDURÍA 1", categoria: "DECORACIÓN" },
  { codigo: "003041501", puesto: "AYUDANTE DE REGIDURÍA 2", categoria: "DECORACIÓN" },
  { codigo: "003041600", puesto: "AUXILIAR DE REGIDURÍA", categoria: "DECORACIÓN" },
  { codigo: "003041700", puesto: "AYUDANTE DE ATREZZO 1", categoria: "DECORACIÓN" },
  { codigo: "003041701", puesto: "AYUDANTE DE ATREZZO 2", categoria: "DECORACIÓN" },
  { codigo: "003041702", puesto: "AYUDANTE DE ATREZZO 3", categoria: "DECORACIÓN" },
  { codigo: "003041800", puesto: "AUXILIAR DE ATREZZO 1", categoria: "DECORACIÓN" },
  { codigo: "003041801", puesto: "AUXILIAR DE ATREZZO 2", categoria: "DECORACIÓN" },
  { codigo: "003041802", puesto: "AUXILIAR DE ATREZZO 3", categoria: "DECORACIÓN" },
  { codigo: "003041803", puesto: "AUXILIAR DE ATREZZO 4", categoria: "DECORACIÓN" },
  { codigo: "003041804", puesto: "AUXILIAR DE ATREZZO 5", categoria: "DECORACIÓN" },
  { codigo: "003041805", puesto: "AUXILIAR DE ATREZZO 6", categoria: "DECORACIÓN" },
  { codigo: "003041806", puesto: "AUXILIAR DE ATREZZO 7", categoria: "DECORACIÓN" },
  { codigo: "003041807", puesto: "AUXILIAR DE ATREZZO 8", categoria: "DECORACIÓN" },
  { codigo: "003041900", puesto: "JEFE/A DE VEHÍCULOS DE ESCENA 1", categoria: "DECORACIÓN" },
  { codigo: "003041901", puesto: "JEFE/A DE VEHÍCULOS DE ESCENA 2", categoria: "DECORACIÓN" },
  { codigo: "003042000", puesto: "JEFE/A DE CONSTRUCCIÓN", categoria: "DECORACIÓN" },
  { codigo: "003042100", puesto: "AYUDANTE DE CONSTRUCCIÓN", categoria: "DECORACIÓN" },
  { codigo: "003042200", puesto: "ESCAYOLISTA", categoria: "DECORACIÓN" },
  { codigo: "003042300", puesto: "CARPINTERO/A", categoria: "DECORACIÓN" },
  { codigo: "003042400", puesto: "PINTOR/A", categoria: "DECORACIÓN" },
  { codigo: "003042500", puesto: "HERRERO/A / CERRAJERO/A", categoria: "DECORACIÓN" },
  { codigo: "003042600", puesto: "TAPICERO/A", categoria: "DECORACIÓN" },
  { codigo: "003042700", puesto: "PAISAJISTA", categoria: "DECORACIÓN" },
  { codigo: "003042800", puesto: "PEONES DE DECORACIÓN", categoria: "DECORACIÓN" },
  { codigo: "003042900", puesto: "MERITORIO/A DE DECORACIÓN", categoria: "DECORACIÓN" },
  { codigo: "003043000", puesto: "BECARIO/A DE DECORACIÓN", categoria: "DECORACIÓN" },
  { codigo: "003043100", puesto: "REFUERZOS DE DECORACIÓN", categoria: "DECORACIÓN" },
  { codigo: "003043200", puesto: "HORAS EXTRAS DECORACIÓN", categoria: "DECORACIÓN" },
  { codigo: "003050100", puesto: "DISEÑADOR/A DE VESTUARIO - FIGURINISTA", categoria: "VESTUARIO" },
  { codigo: "003050200", puesto: "JEFE/A DE VESTUARIO", categoria: "VESTUARIO" },
  { codigo: "003050300", puesto: "COORDINADOR/A DE VESTUARIO", categoria: "VESTUARIO" },
  { codigo: "003050400", puesto: "AYUDANTE DE VESTUARIO 1", categoria: "VESTUARIO" },
  { codigo: "003050401", puesto: "AYUDANTE DE VESTUARIO 2", categoria: "VESTUARIO" },
  { codigo: "003050402", puesto: "AYUDANTE DE VESTUARIO 3", categoria: "VESTUARIO" },
  { codigo: "003050500", puesto: "AUXILIAR DE VESTUARIO 1", categoria: "VESTUARIO" },
  { codigo: "003050501", puesto: "AUXILIAR DE VESTUARIO 2", categoria: "VESTUARIO" },
  { codigo: "003050502", puesto: "AUXILIAR DE VESTUARIO 3", categoria: "VESTUARIO" },
  { codigo: "003050600", puesto: "SASTRE/A (CONFECCIÓN)", categoria: "VESTUARIO" },
  { codigo: "003050700", puesto: "SASTRE/A DE RODAJE", categoria: "VESTUARIO" },
  { codigo: "003050800", puesto: "AUXILIAR DE SASTRERÍA", categoria: "VESTUARIO" },
  { codigo: "003050900", puesto: "PEONES DE VESTUARIO 1", categoria: "VESTUARIO" },
  { codigo: "003050901", puesto: "PEONES DE VESTUARIO 2", categoria: "VESTUARIO" },
  { codigo: "003051000", puesto: "MERITORIO/A DE VESTUARIO 1", categoria: "VESTUARIO" },
  { codigo: "003051001", puesto: "MERITORIO/A DE VESTUARIO 2", categoria: "VESTUARIO" },
  { codigo: "003051100", puesto: "BECARIO/A DE VESTUARIO", categoria: "VESTUARIO" },
  { codigo: "003051200", puesto: "REFUERZOS DE VESTUARIO", categoria: "VESTUARIO" },
  { codigo: "003051300", puesto: "HORAS EXTRAS VESTUARIO", categoria: "VESTUARIO" },
  { codigo: "003060100", puesto: "JEFE/A DE MAQUILLAJE 1", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060101", puesto: "JEFE/A DE MAQUILLAJE 2", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060102", puesto: "JEFE/A DE MAQUILLAJE 3", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060103", puesto: "JEFE/A DE MAQUILLAJE 4", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060200", puesto: "COORDINADOR/A DE MAQUILLAJE 1", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060201", puesto: "COORDINADOR/A DE MAQUILLAJE 2", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060300", puesto: "AYUDANTE DE MAQUILLAJE 1", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060301", puesto: "AYUDANTE DE MAQUILLAJE 2", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060302", puesto: "AYUDANTE DE MAQUILLAJE 3", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060400", puesto: "AUXILIAR DE MAQUILLAJE 1", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060401", puesto: "AUXILIAR DE MAQUILLAJE 2", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060500", puesto: "CARACTERIZADOR/A", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060600", puesto: "AYUDANTE DE CARACTERIZACIÓN", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060700", puesto: "AUXILIAR DE CARACTERIZACIÓN", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060800", puesto: "MAQUILLADOR/A DE FX", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003060900", puesto: "AYUDANTE DE FX", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003061000", puesto: "AUXILIAR DE FX", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003061100", puesto: "MERITORIO/A DE MAQUILLAJE", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003061200", puesto: "BECARIO/A DE MAQUILLAJE", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003061300", puesto: "REFUERZOS DE MAQUILLAJE", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003061400", puesto: "HORAS EXTRAS MAQUILLAJE", categoria: "MAQUILLADORES. CARACTERIZADORES" },
  { codigo: "003070100", puesto: "JEFE DE PELUQUERO/A", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070200", puesto: "AYUDANTE DE PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070300", puesto: "AUXILIAR DE PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070400", puesto: "POSTICERO/A", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070500", puesto: "AYUDANTE DE POSTICERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070600", puesto: "MERITORIO/A DE PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070700", puesto: "BECARIO/A DE PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070800", puesto: "REFUERZOS DE PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003070900", puesto: "HORAS EXTRAS  PELUQUERÍA", categoria: "EQUIPO PROGRAMAS ESPECIALES" },
  { codigo: "003080100", puesto: "COORDINADOR/A DE EFECTOS ESPEC", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080200", puesto: "JEFE/A DE EFECTOS ESPECIALES", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080300", puesto: "AYUDANTE DE EFECTOS ESPECIALES 1", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080301", puesto: "AYUDANTE DE EFECTOS ESPECIALES 2", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080400", puesto: "AUXILIAR DE EFECTOS ESPECIALES", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080500", puesto: "ARMERO/A", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080600", puesto: "AYUDANTE DE ARMERO/A", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080700", puesto: "MERITORIO/A DE EFECTOS ESPECIA", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080800", puesto: "BECARIO/A DE EFECTOS ESPECIALE", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003080900", puesto: "REFUERZOS DE EFECTOS ESPECIALE", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003081000", puesto: "HORAS EXTRAS EFECTOS ESPECIALE", categoria: "TÉCNICOS/ AS EFECTOS ESPECIALES Y SONOROS" },
  { codigo: "003090100", puesto: "JEFE/A DE SONIDO 1", categoria: "SONIDO" },
  { codigo: "003090101", puesto: "JEFE/A DE SONIDO 2", categoria: "SONIDO" },
  { codigo: "003090200", puesto: "AYUDANTE DE SONIDO 1", categoria: "SONIDO" },
  { codigo: "003090201", puesto: "AYUDANTE DE SONIDO 2", categoria: "SONIDO" },
  { codigo: "003090300", puesto: "MICROFONISTA 1 1", categoria: "SONIDO" },
  { codigo: "003090301", puesto: "MICROFONISTA 2", categoria: "SONIDO" },
  { codigo: "003090302", puesto: "MICROFONISTA 1 2", categoria: "SONIDO" },
  { codigo: "003090400", puesto: "AUXILIAR DE SONIDO", categoria: "SONIDO" },
  { codigo: "003090500", puesto: "MERITORIO/A DE SONIDO", categoria: "SONIDO" },
  { codigo: "003090600", puesto: "BECARIO/A DE SONIDO", categoria: "SONIDO" },
  { codigo: "003090700", puesto: "REFUERZOS DE SONIDO", categoria: "SONIDO" },
  { codigo: "003090800", puesto: "HORAS EXTRAS SONIDO", categoria: "SONIDO" },
  { codigo: "003100100", puesto: "COORDINADOR/A DE POSTPRODUCCIÓ 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100101", puesto: "COORDINADOR/A DE POSTPRODUCCIÓ 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100200", puesto: "AYUDANTE DE COORDINADOR DE POSTPRODUCCIÓN 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100201", puesto: "AYUDANTE DE COORDINADOR DE POSTPRODUCCIÓN 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100300", puesto: "MONTADOR/A 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100301", puesto: "MONTADOR/A 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100400", puesto: "AYUDANTE DE MONTAJE 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100401", puesto: "AYUDANTE DE MONTAJE 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100402", puesto: "AYUDANTE DE MONTAJE 3", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100403", puesto: "AYUDANTE DE MONTAJE 4", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100500", puesto: "DIGITALIZADOR/A 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100501", puesto: "DIGITALIZADOR/A 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100502", puesto: "DIGITALIZADOR/A 3", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100600", puesto: "SUPERVISOR/A DE VFX", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100700", puesto: "GRAFISTA", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100800", puesto: "AYUDANTE DE GRAFISMO 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100801", puesto: "AYUDANTE DE GRAFISMO 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003100900", puesto: "JEFE/A DE ANIMACIÓN", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101000", puesto: "ANIMADOR/A", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101100", puesto: "TRANSCIPTOR/A", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101200", puesto: "SUBTITULADOR/A 1", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101201", puesto: "SUBTITULADOR/A 2", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101202", puesto: "SUBTITULADOR/A 3", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101300", puesto: "MONTADOR/A DE SONIDO", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101400", puesto: "AYUDANTE DE MONTAJE DE SONIDO", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101500", puesto: "MERITORIO/A DE MONTAJE", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101600", puesto: "BECARIO/A DE MONTAJE", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101700", puesto: "REFUERZOS DE MONTAJE", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003101800", puesto: "HORAS EXTRAS MONTAJE", categoria: "EQUIPO DE POSTPRODUCCIÓN" },
  { codigo: "003110100", puesto: "JEFE/A ELÉCTRICOS", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110200", puesto: "BEST-BOY 1", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110201", puesto: "BEST-BOY 2", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110300", puesto: "ELÉCTRICO/A 1", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110301", puesto: "ELÉCTRICO/A 2", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110302", puesto: "ELÉCTRICO/A 3", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110303", puesto: "ELÉCTRICO/A 4", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110304", puesto: "ELÉCTRICO/A 5", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110305", puesto: "ELÉCTRICO/A 6", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110306", puesto: "ELÉCTRICO/A 7", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110400", puesto: "RIGGER GAFFER", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110500", puesto: "BEST-BOY RIGGER", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110600", puesto: "RIGGER", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110700", puesto: "GRUPISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110800", puesto: "MERITORIO/A DE ELÉCTRICO", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003110900", puesto: "BECARIO/A DE ELÉCTRICO", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111000", puesto: "REFUERZOS ELÉCTRICO", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111100", puesto: "HORAS EXTRAS ELÉCTRICOS Y RIGGER", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111200", puesto: "JEFE/A DE MAQUINISTA 1", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111201", puesto: "JEFE/A DE MAQUINISTA 2", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111300", puesto: "MAQUINISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111400", puesto: "AYUDANTE DE MAQUINISTA 1", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111401", puesto: "AYUDANTE DE MAQUINISTA 2", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111500", puesto: "AUXILIAR DE MAQUINISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111600", puesto: "MERITORIO/A DE MAQUINISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111700", puesto: "BECARIO/A DE MAQUINISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111800", puesto: "REFUERZOS MAQUINISTA", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003111900", puesto: "HORAS EXTRAS MAQUINISTAS", categoria: "ELÉCTRICOS. MAQUINISTAS" },
  { codigo: "003120100", puesto: "MÉDICOS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120200", puesto: "ENFERMERO/A", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120300", puesto: "OTROS SANITARIOS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120400", puesto: "TÉCNICO/A EN PREVENCIÓN DE RIESGOS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120500", puesto: "AYUDANTE DE TÉCNICO EN PREVENCIÓN", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120600", puesto: "BOMBEROS/AS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120700", puesto: "PROTECCIÓN CIVIL", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120800", puesto: "SEGURIDAD PRIVADA", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003120900", puesto: "GUARDAESPALDAS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121000", puesto: "BLOCKERS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121100", puesto: "PERSONAL DE LIMPIEZA", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121200", puesto: "PERSONAL DE LIMPIEZA HIGIENICO", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121300", puesto: "PERSONAL PARA RESERVAS DE ESPACIO", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121400", puesto: "MOZOS/AS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121500", puesto: "COORDINADOR/A DE SEMOVIENTES", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121600", puesto: "CUADRERO/A", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121700", puesto: "RAMALERO/A 1", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121701", puesto: "RAMALERO/A 2", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121702", puesto: "RAMALERO/A 3", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121800", puesto: "ADIESTRADOR/A", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121900", puesto: "VETERINARIO/A 1", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003121901", puesto: "VETERINARIO/A 2", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003122000", puesto: "ENTRENADORES/AS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003122100", puesto: "PROFESORES/AS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
  { codigo: "003122200", puesto: "BUZOS", categoria: "PERSONAL COMPLEMENTARIO Y OTROS" },
];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: SELECTOR DE PUESTO (filtrable + agrupado + permite texto libre)
// ═══════════════════════════════════════════════════════════════════
function PuestoSelector({ puesto, codigoContable, onPuesto, onCodigoContable }) {
  const [mostrarLista, setMostrarLista] = useState(false);
  const [busqueda, setBusqueda] = useState(puesto || "");
  const [puestosLista, setPuestosLista] = useState(() => {
    // Fallback inicial: constante embebida (normalizada al formato {codigo, nombre, categoria})
    return PUESTOS_COAC.map(p => ({ codigo: p.codigo, nombre: p.puesto, categoria: p.categoria }));
  });
  const [cargandoLista, setCargandoLista] = useState(true);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  // Cargar lista desde Supabase al montar (con fallback silencioso a la constante embebida)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await listarPuestosCoac();
        if (cancelado) return;
        if (Array.isArray(data) && data.length > 0) {
          // Normalizar a {codigo, nombre, categoria}
          setPuestosLista(data.map(p => ({
            codigo: p.codigo,
            nombre: p.nombre,
            categoria: p.categoria,
          })));
        }
        // Si data está vacío, se queda con el fallback embebido
      } catch (e) {
        // Si Supabase falla, mantenemos la constante embebida (no rompemos la app)
        console.warn("listarPuestosCoac falló, usando lista embebida:", e.message);
      } finally {
        if (!cancelado) setCargandoLista(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Sincronizar búsqueda cuando cambia el puesto externamente (ej. al cargar perfil)
  useEffect(() => {
    setBusqueda(puesto || "");
  }, [puesto]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!mostrarLista) return;
    const onClickFuera = (e) => {
      if (listaRef.current && !listaRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setMostrarLista(false);
      }
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [mostrarLista]);

  // Filtrar puestos según búsqueda
  const norm = (s) => (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // sin acentos
  const q = norm(busqueda);
  const puestosFiltrados = q
    ? puestosLista.filter(p => norm(p.nombre).includes(q) || norm(p.codigo).includes(q) || norm(p.categoria).includes(q))
    : puestosLista;

  // Agrupar por categoría
  const grupos = {};
  for (const p of puestosFiltrados) {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  }

  const seleccionar = (p) => {
    onPuesto(p.nombre);
    onCodigoContable(p.codigo);
    setBusqueda(p.nombre);
    setMostrarLista(false);
  };

  const onInputChange = (val) => {
    setBusqueda(val);
    onPuesto(val);
    // Si lo que escribe coincide exactamente con algún puesto, asignar su código
    const match = puestosLista.find(p => p.nombre === val);
    if (match) onCodigoContable(match.codigo);
    else onCodigoContable(""); // texto libre = sin código
  };

  const inp = { padding: "11px 13px", fontSize: 13, border: "1px solid #c0bcb5", borderRadius: 6, fontFamily: "'Courier New',monospace", boxSizing: "border-box", width: "100%", outline: "none", background: "#fafaf7", color: "#1a1a1a" };
  const LS = { display: "block", fontSize: 10, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700, fontFamily: "'Courier New',monospace" };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LS}>Puesto</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={busqueda}
          onChange={e => onInputChange(e.target.value)}
          onFocus={() => setMostrarLista(true)}
          placeholder="Escribe para filtrar o elige de la lista..."
          style={inp}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setMostrarLista(!mostrarLista)}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", fontSize: 12, color: "#666" }}
          tabIndex={-1}
        >
          {mostrarLista ? "▲" : "▼"}
        </button>
      </div>

      {mostrarLista && (
        <div
          ref={listaRef}
          style={{
            position: "relative", zIndex: 100, marginTop: 4,
            background: "#fff", border: "1px solid #c0bcb5", borderRadius: 6,
            maxHeight: 320, overflowY: "auto", fontFamily: "'Courier New',monospace",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {puestosFiltrados.length === 0 ? (
            <div style={{ padding: 14, textAlign: "center", color: "#888", fontSize: 11, fontStyle: "italic" }}>
              Sin resultados. Puedes escribir libremente este puesto sin código.
            </div>
          ) : (
            Object.entries(grupos).map(([cat, items]) => (
              <div key={cat}>
                <div style={{ padding: "6px 12px", background: "#f0ede8", fontSize: 9, color: "#7a5a2a", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid #e0ddd8", position: "sticky", top: 0 }}>
                  {cat} <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 4 }}>({items.length})</span>
                </div>
                {items.map(p => (
                  <div
                    key={p.codigo}
                    onClick={() => seleccionar(p)}
                    style={{
                      padding: "7px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderBottom: "1px solid #f0ede8", fontSize: 11,
                      background: p.nombre === puesto ? "rgba(184,134,74,0.1)" : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(184,134,74,0.15)"}
                    onMouseLeave={e => e.currentTarget.style.background = p.nombre === puesto ? "rgba(184,134,74,0.1)" : "transparent"}
                  >
                    <span style={{ color: "#1a1a1a", fontWeight: p.nombre === puesto ? 700 : 400 }}>{p.nombre}</span>
                    <span style={{ color: "#888", fontSize: 10, fontFamily: "'Courier New',monospace" }}>{p.codigo}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Campo Código Contable (solo lectura) */}
      <div style={{ marginTop: 10 }}>
        <label style={LS}>Código Contable</label>
        <input
          type="text"
          value={codigoContable || ""}
          readOnly
          placeholder="— se rellena automáticamente al elegir un puesto —"
          style={{ ...inp, background: codigoContable ? "#f0ede8" : "#fafaf7", color: codigoContable ? "#1a1a1a" : "#aaa", fontWeight: codigoContable ? 700 : 400, cursor: "default" }}
        />
        {!codigoContable && busqueda && (
          <div style={{ fontSize: 9, color: "#a07030", marginTop: 4, fontFamily: "'Courier New',monospace", fontStyle: "italic" }}>
            ℹ Puesto no estándar (sin código contable asignado)
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES COSTE EMPRESA
// ═══════════════════════════════════════════════════════════════════
const CE_TOPE_BASE       = 5101.20;            // Tope mensual base máxima cotización
const CE_PCT_SS          = 0.3335;             // 33,35% empresa SS
const CE_SS_TOPADA       = CE_TOPE_BASE * CE_PCT_SS; // 1.701,25 €
const CE_PCT_SS_HEXTRA   = 0.27;               // 27% sobre horas extra
const CE_PCT_IMEI        = 0.0075;             // 0,75% IMEI (MEI)
const CE_IMEI_TOPADO     = CE_TOPE_BASE * CE_PCT_IMEI; // 38,26 €
// Cuota Solidaridad sobre el exceso de la base máxima:
const CE_PCT_SOL_T1      = 0.0097;             // 0-10% exceso (primeros 510,12 €)
const CE_PCT_SOL_T2      = 0.0115;             // 10-50% exceso (siguientes 2.040,48 €)
const CE_PCT_SOL_T3      = 0.0133;             // >50% exceso (resto)
const CE_SOL_T1_HASTA    = CE_TOPE_BASE * 0.10; // 510,12 €
const CE_SOL_T2_HASTA    = CE_TOPE_BASE * 0.50; // 2.550,60 €
// Gestoría
const CE_GESTORIA_ALTA   = 6;
const CE_GESTORIA_MES    = 26;

// Cálculo del coste empresa para un mes
// Recibe los importes brutos del mes y devuelve un objeto con cada concepto
function calcularCosteEmpresaMes({
  total,         // TOTAL del mes (lo que percibe el trabajador)
  vacaciones,    // importe vacaciones del mes
  indem,         // importe indemnización del mes
  horasExtraEur, // importe h.extra en euros del mes
  plusVivienda,  // importe plus vivienda del mes
  irpfActivo,    // boolean: ¿empresa asume IRPF?
  pctIRPF,       // 0-100: % IRPF del trabajador
  esPrimerMes,   // boolean: ¿es el primer mes del contrato?
  importeExento = 0, // importe a restar de las bases SS/IMEI/Solidaridad (por baja médica)
  firmaContrato = true, // boolean: ¿hay firma de contrato este primer mes? (afecta solo si esPrimerMes)
}) {
  const exento = Math.max(0, importeExento || 0);

  // Base SS principal: TOTAL - vacaciones - indemnización - importe exento
  // (las vacaciones tienen su propia SS aparte)
  const baseSSPrincipal = Math.max(0, (total || 0) - (vacaciones || 0) - (indem || 0) - exento);
  const ssPrincipal     = baseSSPrincipal > CE_TOPE_BASE ? CE_SS_TOPADA : baseSSPrincipal * CE_PCT_SS;

  // SS Vacaciones: siempre 33,35% × vacaciones (suma aparte, NO afectada por exención)
  const ssVacaciones    = (vacaciones || 0) * CE_PCT_SS;

  // SS H.Extra: siempre 27% × h.extra (suma aparte, NO afectada por exención)
  const ssHorasExtra    = (horasExtraEur || 0) * CE_PCT_SS_HEXTRA;

  // Base IMEI: TOTAL - indemnización - importe exento (vacaciones SÍ cuentan)
  const baseIMEI        = Math.max(0, (total || 0) - (indem || 0) - exento);
  const imeiCalc        = baseIMEI > CE_TOPE_BASE ? CE_IMEI_TOPADO : baseIMEI * CE_PCT_IMEI;

  // Base Solidaridad: TOTAL - indemnización - vacaciones - horas extra - importe exento
  // (igual concepto que la Base SS Principal — solo el salario "regular")
  const baseSolidaridad = Math.max(0, (total || 0) - (indem || 0) - (vacaciones || 0) - (horasExtraEur || 0) - exento);
  let solidaridad = 0;
  if (baseSolidaridad > CE_TOPE_BASE) {
    const exc = baseSolidaridad - CE_TOPE_BASE;
    solidaridad += Math.min(exc, CE_SOL_T1_HASTA) * CE_PCT_SOL_T1;
    if (exc > CE_SOL_T1_HASTA) {
      solidaridad += Math.min(exc - CE_SOL_T1_HASTA, CE_SOL_T2_HASTA - CE_SOL_T1_HASTA) * CE_PCT_SOL_T2;
    }
    if (exc > CE_SOL_T2_HASTA) {
      solidaridad += (exc - CE_SOL_T2_HASTA) * CE_PCT_SOL_T3;
    }
  }

  // IRPF Plus Vivienda (solo si empresa lo asume)
  const irpfVivienda = (irpfActivo && pctIRPF > 0)
    ? (plusVivienda || 0) * (pctIRPF / 100)
    : 0;

  // Gestoría:
  // - Si esPrimerMes y firmaContrato → 32 € (6 alta + 26 nómina)
  // - Si esPrimerMes y NO firmaContrato → 26 € (solo nómina, sin alta)
  // - Si NO esPrimerMes → 26 €
  const gestoria = (esPrimerMes && firmaContrato)
    ? (CE_GESTORIA_ALTA + CE_GESTORIA_MES)
    : CE_GESTORIA_MES;

  const totalCosteEmpresa = ssPrincipal + ssVacaciones + ssHorasExtra + imeiCalc + solidaridad + irpfVivienda + gestoria;

  return {
    baseSSPrincipal, ssPrincipal,
    ssVacaciones, ssHorasExtra,
    baseIMEI, imei: imeiCalc,
    baseSolidaridad, solidaridad,
    irpfVivienda,
    gestoria,
    exento,
    totalCosteEmpresa,
  };
}

// ─── LÓGICA DE FECHAS ────────────────────────────────────────────────────────
function calcularPeriodo(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return null;
  const inicio = new Date(fechaInicio + "T00:00:00");
  const fin    = new Date(fechaFin    + "T00:00:00");
  if (fin <= inicio) return null;

  const diaInicio  = inicio.getDate();
  const mesInicio  = inicio.getMonth();
  const anioInicio = inicio.getFullYear();
  const diaFin     = fin.getDate();
  const mesFin     = fin.getMonth();
  const anioFin    = fin.getFullYear();

  let diasNorm = 0;
  const desglose = [];
  let mesActual  = mesInicio;
  let anioActual = anioInicio;

  while (anioActual < anioFin || (anioActual === anioFin && mesActual <= mesFin)) {
    const esPrimerMes   = anioActual === anioInicio && mesActual === mesInicio;
    const esUltimoMes   = anioActual === anioFin    && mesActual === mesFin;
    const ultimoDiaReal = new Date(anioActual, mesActual + 1, 0).getDate();

    let diaDesde, diaHasta;
    if (esPrimerMes && esUltimoMes) { diaDesde = diaInicio; diaHasta = diaFin; }
    else if (esPrimerMes)           { diaDesde = diaInicio; diaHasta = ultimoDiaReal; }
    else if (esUltimoMes)           { diaDesde = 1;         diaHasta = diaFin; }
    else                            { diaDesde = 1;         diaHasta = ultimoDiaReal; }

    const esCompleto  = diaDesde === 1 && diaHasta === ultimoDiaReal;
    const diasReales  = diaHasta - diaDesde + 1;
    const diasNormes  = esCompleto ? 30 : diasReales;
    diasNorm         += diasNormes;
    const fraccion    = diasNormes / 30;

    const nombreMes = new Date(anioActual, mesActual, 1).toLocaleString("es-ES", { month: "long", year: "numeric" });
    desglose.push({ mes: nombreMes, desde: diaDesde, hasta: diaHasta, diasReales, diasNorm: diasNormes, fraccion, esCompleto });
    mesActual++;
    if (mesActual > 11) { mesActual = 0; anioActual++; }
  }

  if (desglose.length > 0) desglose[desglose.length - 1].esElUltimo = true;
  const mesesTotales = diasNorm / 30;

  // Semanas laborables: cada día L-V cuenta 0,2 semanas (recorre días reales del calendario)
  let semanasLaborables = 0;
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    const dow = cursor.getDay(); // 0=dom, 6=sab
    if (dow >= 1 && dow <= 5) semanasLaborables += 0.2;
    cursor.setDate(cursor.getDate() + 1);
  }
  semanasLaborables = Math.round(semanasLaborables * 10) / 10;

  // Añadir semanas laborables por mes al desglose
  desglose.forEach((d, i) => {
    const mesObj = new Date(anioInicio, mesInicio + i, 1);
    const anioM  = mesObj.getFullYear();
    const mesM   = mesObj.getMonth();
    let sw = 0;
    for (let dd = d.desde; dd <= d.hasta; dd++) {
      const dow = new Date(anioM, mesM, dd).getDay();
      if (dow >= 1 && dow <= 5) sw += 0.2;
    }
    d.semanasLaborables = Math.round(sw * 10) / 10;
  });

  return { mesesTotales, semanasTotales: semanasLaborables, diasNormalizados: diasNorm, desglose };
}

// ─── CÁLCULO SALARIAL ────────────────────────────────────────────────────────
function calcularSalario({ salarioPactado, periodo, horasPorMes, vacDiasPorMes,
                           vacAcumulada, indemAcumulada, horasAcumuladas }) {
  if (!periodo) return null;
  const { mesesTotales, semanasTotales, desglose } = periodo;
  const n = desglose.length;

  // ── Referencia mes completo ──
  const base1mes  = salarioPactado * FACTOR_BASE;
  const vac1mes   = base1mes / DIVISOR_VAC;
  const indem1mes = (base1mes / 30) * FACTOR_INDEM_DIA;
  const suma1mes  = base1mes + vac1mes + indem1mes;

  // ── Valores hora ──
  const salarioDia     = base1mes / 30;
  const salarioSemana  = salarioDia * 7;
  const valorHora      = salarioSemana / 40;
  const valorHoraExtra = valorHora * 1.5;

  // ── Horas extra por mes: si está vacío (sin tocar), usar días L-V; si es 0 explícito, respetar 0 ──
  const hxMes = Array.from({ length: n }, (_, i) => {
    const v = horasPorMes[i];
    if (v === undefined || v === null || v === "") {
      return Math.round((desglose[i]?.semanasLaborables || 0) * 5);
    }
    return v || 0;
  });
  const totalHorasExtra = hxMes.reduce((s, h) => s + h, 0);
  const importeHxMes    = hxMes.map(h => h * valorHoraExtra);
  const totalImporteHx  = importeHxMes.reduce((s, v) => s + v, 0);

  // ── Vacaciones disfrutadas por mes ──
  const vdMes = Array.from({ length: n }, (_, i) => vacDiasPorMes[i] ?? 0);
  const totalVacDias    = vdMes.reduce((s, d) => s + d, 0);
  const importeVdMes    = vdMes.map(d => d * salarioDia);
  const totalImporteVd  = importeVdMes.reduce((s, v) => s + v, 0);

  // ── Raw por mes ──
  const rawMes = desglose.map((d, i) => {
    const totalMes = salarioPactado * d.fraccion;
    const baseMes  = totalMes * FACTOR_BASE;
    const vacMes   = baseMes / DIVISOR_VAC;
    const indemMes = (baseMes / 30) * FACTOR_INDEM_DIA;
    return { ...d, totalMes, baseMes, vacMes, indemMes };
  });

  // ── Totales brutos ──
  const totalBase  = rawMes.reduce((s, m) => s + m.baseMes,  0);
  const totalVac   = rawMes.reduce((s, m) => s + m.vacMes,   0);
  const totalIndem = rawMes.reduce((s, m) => s + m.indemMes, 0);
  const totalBruto = rawMes.reduce((s, m) => s + m.totalMes, 0);

  // ── Aplicar modos de pago ──
  const porMes = rawMes.map((d, i) => {
    const esUltimo = i === n - 1;

    // vacaciones del salario (prorrateadas o acumuladas)
    const vacShow = vacAcumulada ? (esUltimo ? totalVac : 0) : d.vacMes;
    // indemnización
    const indemShow = indemAcumulada ? (esUltimo ? totalIndem : 0) : d.indemMes;
    // horas extra
    const hxShow = horasAcumuladas ? (esUltimo ? totalImporteHx : 0) : importeHxMes[i];
    // descuento vacaciones disfrutadas: si vac acumuladas → se restan al final; si no → mes a mes
    const vdShow = vacAcumulada ? (esUltimo ? totalImporteVd : 0) : importeVdMes[i];

    const cobroMes = d.baseMes + vacShow + indemShow + hxShow - vdShow;

    return {
      ...d,
      vacShow, indemShow,
      horasExtraMes: hxMes[i],
      importeHxShow: hxShow,
      vacDiasMes: vdMes[i],
      importeVdShow: vdShow,
      cobroMes,
    };
  });

  const totalFinal = porMes.reduce((s, m) => s + m.cobroMes, 0);
  const promedioMensual = totalFinal / mesesTotales;

  return {
    // referencia
    base1mes, vac1mes, indem1mes, suma1mes,
    salarioDia, salarioSemana, valorHora, valorHoraExtra,
    // horas extra
    totalHorasExtra, totalImporteHx,
    // vacaciones disfrutadas
    totalVacDias, totalImporteVd,
    // por mes
    porMes,
    // totales
    totalBruto, totalBase, totalVac, totalIndem,
    totalFinal, promedioMensual,
    mesesTotales, semanasTotales,
  };
}

// ─── HELPERS UI ──────────────────────────────────────────────────────────────
const fmt  = (n, d = 2) => parseFloat(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtE = (n)        => fmt(n, 2) + " €";
const fmtM = (n)        => fmt(n, 4);

const P = { background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: 8, padding: 24, marginBottom: 20, minWidth: 0 };
const ST = { fontSize: 10, letterSpacing: "0.2em", color: "#b8864a", textTransform: "uppercase", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #e0ddd8" };

// Badge "IMPORTES BRUTOS" – estilo dorado, en línea, visible
const BadgeBrutos = ({ size = "normal" }) => {
  const s = size === "small"
    ? { fontSize: 8, padding: "1px 5px", marginLeft: 6 }
    : size === "inline"
      ? { fontSize: 10, padding: "2px 7px", marginLeft: 8 }
      : { fontSize: 10, padding: "2px 8px", marginLeft: 10 };
  return (
    <span style={{
      display: "inline-block",
      background: "#b8864a",
      color: "#fff",
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      borderRadius: 3,
      fontFamily: "'Courier New', monospace",
      verticalAlign: "middle",
      ...s,
    }}>Importes Brutos</span>
  );
};
const LS = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 6, fontFamily: "'Courier New', monospace" };

function Field({ label, value, onChange, type = "number", prefix, hint, small, readOnly, lockHint }) {
  return (
    <div style={{ marginBottom: small ? 8 : 14, minWidth: 0 }}>
      {label && (
        <label style={{ ...LS, fontSize: small ? 9 : 10 }}>
          {label}{readOnly && <span style={{ marginLeft: 6, color: "#b8864a" }}>🔒</span>}
        </label>
      )}
      <div style={{ position: "relative", minWidth: 0 }}>
        {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#b8864a", fontWeight: 700, fontSize: 13, fontFamily: "'Courier New', monospace" }}>{prefix}</span>}
        <input
          type={type === "date" ? "date" : type === "text" ? "text" : "number"}
          value={value}
          onChange={e => readOnly ? null : onChange(type === "text" || type === "date" ? e.target.value : parseFloat(e.target.value) || 0)}
          readOnly={!!readOnly}
          tabIndex={readOnly ? -1 : undefined}
          step="any" min="0"
          style={{
            width: "100%",
            background: readOnly ? "#e5e2dd" : "#f0ede8",
            border: `1px solid ${readOnly ? "#c8a96e" : "#d0ccc6"}`,
            borderRadius: 4,
            color: readOnly ? "#666" : "#1a1a1a",
            fontFamily: "'Courier New', monospace",
            fontSize: small ? 13 : 14,
            padding: prefix ? (small ? "7px 8px 7px 22px" : "9px 10px 9px 26px") : (small ? "7px 10px" : "9px 12px"),
            outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
            colorScheme: "light",
            cursor: readOnly ? "not-allowed" : "text",
          }}
          onFocus={e => { if (!readOnly) e.target.style.borderColor = "#c8a96e"; }}
          onBlur={e  => { if (!readOnly) e.target.style.borderColor = "#2a2a2a"; }}
        />
      </div>
      {hint && <p style={{ margin: "3px 0 0", fontSize: 9, color: "#777", fontFamily: "'Courier New', monospace" }}>{hint}</p>}
      {readOnly && lockHint && <p style={{ margin: "3px 0 0", fontSize: 9, color: "#b8864a", fontFamily: "'Courier New', monospace", fontStyle: "italic" }}>{lockHint}</p>}
    </div>
  );
}

function Toggle({ label, sublabel, value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 13px", background: "#f0ede8", borderRadius: 6,
      border: `1px solid ${value ? "#c8963a" : "#e0ddd8"}`, marginBottom: 10, cursor: "pointer",
    }}>
      <div>
        <div style={{ fontSize: 11, color: value ? "#7a5a2a" : "#999", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 9, color: "#777", marginTop: 2, fontFamily: "'Courier New', monospace" }}>{sublabel}</div>}
      </div>
      <div style={{ position: "relative", width: 38, height: 20, flexShrink: 0, marginLeft: 12 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 10, background: value ? "#c8a96e" : "#222", transition: "background 0.25s" }} />
        <div style={{ position: "absolute", top: 3, left: value ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: value ? "#fff" : "#aaa", transition: "left 0.25s", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
      </div>
    </div>
  );
}

function Row({ label, value, sub, highlight, green, muted }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: highlight ? "11px 14px" : "7px 0",
      background: highlight ? "rgba(184,134,74,0.08)" : "transparent",
      borderRadius: highlight ? 4 : 0,
      borderBottom: highlight ? "none" : "1px solid #191919",
      marginBottom: highlight ? 6 : 0,
    }}>
      <span style={{ fontSize: highlight ? 11 : 10, letterSpacing: "0.07em", textTransform: "uppercase", color: highlight ? "#7a5a2a" : muted ? "#999" : "#1a1a1a", fontFamily: "'Courier New', monospace", fontWeight: highlight ? 700 : 400 }}>
        {label}
        {sub && <span style={{ display: "block", fontSize: 9, color: "#888", marginTop: 2 }}>{sub}</span>}
      </span>
      <span style={{ fontSize: highlight ? 17 : 13, fontWeight: highlight ? 700 : 500, color: green ? "#1a7a58" : highlight ? "#b8864a" : muted ? "#999" : "#1a1a1a", fontFamily: "'Courier New', monospace" }}>
        {value}
      </span>
    </div>
  );
}

function Div() { return <div style={{ height: 1, background: "#e8e4de", margin: "8px 0" }} />; }

// ═══════════════════════════════════════════════════════════════════════
// IMPORTADOR DE PERFILES ANTIGUOS (v46) — solo admin
// Lista los perfiles de localStorage y permite migrarlos a Supabase
// asignándoles un proyecto. NO borra el original de localStorage.
// ═══════════════════════════════════════════════════════════════════════
function ImportadorAntiguos({ usuarioActual, tabId, onCerrar, onImportado }) {
  const [locales, setLocales] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [seleccion, setSeleccion] = useState({}); // { key: proyectoId }
  const [cargando, setCargando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Leer todos los perfiles locales (todos los prefijos)
        const prefijos = ["perfil_unif_", "perfil_45h_", "perfil_40h_"];
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && prefijos.some(p => k.startsWith(p))) keys.push(k);
        }
        const lista = keys.map(k => {
          try {
            const v = localStorage.getItem(k);
            const data = JSON.parse(v);
            return { key: k, ...data };
          } catch { return null; }
        }).filter(Boolean).filter(p => {
          // Filtrar por tabId actual (o antiguos sin tabId → 45H)
          if (p.tabId === tabId) return true;
          if (!p.tabId && tabId === "45h") return true;
          if (!p.tabId && tabId === "40h" && p.key && p.key.startsWith("perfil_40h_")) return true;
          return false;
        });
        setLocales(lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));

        // Cargar proyectos disponibles (admin ve todos)
        const proys = await listarProyectos({
          adminPin: usuarioActual.pin,
          esAdmin: true,
        });
        setProyectos((proys || []).filter(p => p.activo));
      } catch (e) {
        setMensaje({ tipo: "error", texto: "Error al cargar: " + e.message });
      }
      setCargando(false);
    })();
  }, []);

  const importarSeleccionados = async () => {
    const aImportar = Object.entries(seleccion).filter(([_, pid]) => pid);
    if (aImportar.length === 0) {
      alert("Selecciona un proyecto para al menos un perfil");
      return;
    }
    setImportando(true);
    let ok = 0, fallos = 0;
    for (const [key, proyectoId] of aImportar) {
      const p = locales.find(x => x.key === key);
      if (!p) continue;
      try {
        await crearPerfilSupabase({
          proyectoId: Number(proyectoId),
          tabId: p.tabId || tabId,
          nombre: p.nombre,
          autor: p.autor || usuarioActual.nombre,
          datos: p.datos,
        });
        ok++;
      } catch (e) {
        console.error("Error importando", p.nombre, e);
        fallos++;
      }
    }
    setImportando(false);
    setMensaje({
      tipo: fallos === 0 ? "ok" : "warn",
      texto: `Importados: ${ok}${fallos > 0 ? ` · Fallidos: ${fallos}` : ""}. Los originales locales se conservan.`,
    });
    if (ok > 0) setTimeout(() => { onImportado(); }, 1500);
  };

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(20,20,20,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100,
  };
  const modal = {
    background: "#faf7f2", padding: 20, borderRadius: 6, maxWidth: 750, width: "92%",
    maxHeight: "88vh", overflowY: "auto", color: "#1a1a1a",
    fontFamily: "'Courier New',monospace", border: "1px solid #b8864a",
  };

  return (
    <div style={overlay} onClick={onCerrar}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid #e0ddd8", paddingBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a1a1a" }}>📥 Importar Perfiles Antiguos</h2>
          <button onClick={onCerrar} style={{ background: "transparent", color: "#888", border: "1px solid #ccc", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Courier New',monospace" }}>Cerrar</button>
        </div>

        <div style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
          Los perfiles antiguos guardados en este navegador (localStorage) se pueden migrar a la nube asignándoles un proyecto.
          <br /><b>Los originales locales NO se borran</b>, se copian.
        </div>

        {mensaje && (
          <div style={{
            padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 11,
            background: mensaje.tipo === "ok" ? "#e8f5e8" : mensaje.tipo === "warn" ? "#fdf0e0" : "#fdf0f0",
            border: `1px solid ${mensaje.tipo === "ok" ? "#c0e0c0" : mensaje.tipo === "warn" ? "#e8b878" : "#e8c0c0"}`,
            color: mensaje.tipo === "ok" ? "#2a7a50" : mensaje.tipo === "warn" ? "#7a5a2a" : "#b02020",
          }}>{mensaje.texto}</div>
        )}

        {cargando ? (
          <div style={{ padding: 20, textAlign: "center", color: "#888" }}>Cargando...</div>
        ) : locales.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
            No hay perfiles antiguos en este navegador para la pestaña {tabId?.toUpperCase()}.
          </div>
        ) : (
          <>
            {/* Tabla perfiles */}
            <div style={{ maxHeight: "50vh", overflowY: "auto", marginBottom: 12 }}>
              {locales.map(p => (
                <div key={p.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: 10, background: "#fff", borderRadius: 4, marginBottom: 6, border: "1px solid #e8e4de", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{p.nombre}</div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                      {p.datos?.proyecto && <><span style={{ color: "#b8864a" }}>{p.datos.proyecto}</span>{p.datos?.productora && ` · ${p.datos.productora}`} · </>}
                      {p.datos?.nombre || "—"} · {p.datos?.puesto || "—"}
                      {p.datos?.fechaInicio && ` · ${p.datos.fechaInicio}→${p.datos.fechaFin}`}
                    </div>
                    <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>
                      {p.timestamp ? new Date(p.timestamp).toLocaleString("es-ES") : "—"}
                    </div>
                  </div>
                  <select
                    value={seleccion[p.key] || ""}
                    onChange={e => setSeleccion({ ...seleccion, [p.key]: e.target.value })}
                    style={{ padding: "6px 8px", border: "1px solid #d0ccc6", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 11, background: "#fff", color: "#1a1a1a", minWidth: 180 }}
                  >
                    <option value="">— No importar —</option>
                    {proyectos.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e0ddd8", paddingTop: 12 }}>
              <button
                onClick={onCerrar}
                disabled={importando}
                style={{ background: "transparent", color: "#666", border: "1px solid #ccc", padding: "8px 16px", borderRadius: 4, cursor: importando ? "wait" : "pointer", fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >Cancelar</button>
              <button
                onClick={importarSeleccionados}
                disabled={importando}
                style={{ background: "#b8864a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: importando ? "wait" : "pointer", fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >{importando ? "Importando..." : "Importar seleccionados"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── GESTOR DE PERFILES ──────────────────────────────────────────────────────
function GestorPerfiles({ tabId, datosActuales, onCargarPerfil }) {
  const usuarioCtx = useContext(UsuarioContext);
  const proyectoActivoCtx = useContext(ProyectoContext); // v46
  const esAdmin = !!usuarioCtx?.es_admin;
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [mostrarGuardar, setMostrarGuardar] = useState(false);
  const [verTodosProyectos, setVerTodosProyectos] = useState(false); // v46: toggle admin
  const [huboFallbackSupabase, setHuboFallbackSupabase] = useState(false); // v46: para avisar
  const [mostrarImportador, setMostrarImportador] = useState(false); // v46: modal importar antiguos

  const STORAGE_PREFIX = `perfil_unif_`;
  const STORAGE_PREFIXES_LEGACY = [`perfil_40h_`, `perfil_45h_`];

  // Adaptador: usa window.storage si existe (artefactos Claude.ai),
  // si no, usa localStorage del navegador (Vercel/local/etc.)
  const storage = (() => {
    if (typeof window !== "undefined" && window.storage) return window.storage;
    return {
      list: async (prefix) => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        return { keys };
      },
      get: async (key) => {
        const value = localStorage.getItem(key);
        if (value === null) throw new Error("Not found");
        return { value };
      },
      set: async (key, value) => {
        localStorage.setItem(key, value);
        return { ok: true };
      },
      delete: async (key) => {
        localStorage.removeItem(key);
        return { ok: true };
      },
    };
  })();

  useEffect(() => {
    (async () => {
      try {
        // v46: Cargar de Supabase (fuente principal) + localStorage (respaldo)
        // Admin puede ver todos los proyectos con toggle
        const supTabId = tabId === "45h" ? "45h" : tabId === "40h" ? "40h" : tabId;
        const perfilesSup = await listarPerfilesSupabase({
          tabId: supTabId,
          proyectoId: proyectoActivoCtx?.id || null,
          verTodos: esAdmin && verTodosProyectos,
          adminPin: esAdmin ? usuarioCtx.pin : null,
        });

        let listaFinal = [];
        let supOK = true;

        if (perfilesSup === null) {
          // Error de red → fallback a localStorage
          supOK = false;
          setHuboFallbackSupabase(true);
        } else {
          // Mapear perfiles Supabase al formato interno { key, nombre, tabId, timestamp, autor, datos, proyecto_id }
          listaFinal = perfilesSup.map(p => ({
            key: `sup_${p.id}`,           // prefijo "sup_" distingue Supabase
            supabaseId: p.id,             // id real en Supabase
            proyectoId: p.proyecto_id,
            nombre: p.nombre,
            tabId: p.tab_id,
            timestamp: new Date(p.created_at).getTime(),
            autor: p.autor,
            datos: p.datos,
            fuente: "supabase",
          }));
          setHuboFallbackSupabase(false);
        }

        // Cargar de localStorage (respaldo)
        const todosPrefijos = [STORAGE_PREFIX, ...STORAGE_PREFIXES_LEGACY];
        const todasLasKeys = [];
        for (const prefix of todosPrefijos) {
          try {
            const res = await storage.list(prefix);
            if (res && res.keys) todasLasKeys.push(...res.keys);
          } catch (e) { /* ignorar */ }
        }
        const listaLocal = await Promise.all(todasLasKeys.map(async k => {
          try {
            const d = await storage.get(k);
            const data = JSON.parse(d.value);
            return { key: k, fuente: "local", ...data };
          } catch { return null; }
        }));
        const localFiltrado = listaLocal.filter(Boolean).filter(p => {
          if (!tabId) return true;
          if (p.tabId === tabId) return true;
          if (!p.tabId && tabId === "45h") return true;
          if (!p.tabId && tabId === "40h" && p.key && p.key.startsWith("perfil_40h_")) return true;
          return false;
        });

        // v46: Decidir qué perfiles locales mostrar según rol
        // - Si Supabase falló → mostrar todos los locales (respaldo)
        // - Si Supabase OK y ADMIN → añadir locales sin proyecto_id (los "antiguos") solo si NO estamos en modo verTodos
        //   (si verTodos, ya vemos los de Supabase; los antiguos son locales)
        //   → siempre mostramos antiguos locales al admin
        // - Si Supabase OK y USUARIO NORMAL → NO mostrar antiguos (solo los del proyecto activo)
        let extrasLocal = [];
        if (!supOK) {
          extrasLocal = localFiltrado;
        } else if (esAdmin) {
          // Admin ve los antiguos locales (los que no están en Supabase = no tienen proyecto_id)
          extrasLocal = localFiltrado;
        }
        // Evitar duplicados por nombre+timestamp (por si algún antiguo ya se migró)
        const claves = new Set(listaFinal.map(p => `${p.nombre}::${p.timestamp}`));
        for (const p of extrasLocal) {
          const k = `${p.nombre}::${p.timestamp}`;
          if (!claves.has(k)) {
            listaFinal.push(p);
            claves.add(k);
          }
        }

        setPerfiles(listaFinal.sort((a,b) => (b.timestamp||0) - (a.timestamp||0)));
      } catch (e) { console.error("Error cargando perfiles:", e); }
      setCargando(false);
    })();
  }, [tabId, proyectoActivoCtx?.id, verTodosProyectos]);

  const showMsg = (texto, tipo = "ok") => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 2500);
  };

  const guardarPerfil = async () => {
    // Si el usuario no escribió nada, usar el placeholder sugerido como nombre
    let nombre = nombrePerfil.trim();
    if (!nombre) {
      const sugerido = datosActuales.nombre
        ? `${datosActuales.nombre} · ${datosActuales.puesto || ""}`.trim().replace(/·\s*$/,"").trim()
        : "";
      if (sugerido && sugerido !== "·") {
        nombre = sugerido;
      } else {
        showMsg("Introduce un nombre o rellena los datos del trabajador", "error");
        return;
      }
    }
    const key = `${STORAGE_PREFIX}${Date.now()}_${nombre.replace(/[^a-zA-Z0-9]/g,"_").slice(0,40)}`;
    const payload = {
      nombre,
      tabId,
      timestamp: Date.now(),
      autor: usuarioCtx?.nombre || null,
      datos: datosActuales,
    };
    // v46: guardar en Supabase (principal) Y localStorage (respaldo)
    let supabaseOK = false;
    let supabaseId = null;
    if (proyectoActivoCtx?.id) {
      try {
        const res = await crearPerfilSupabase({
          proyectoId: proyectoActivoCtx.id,
          tabId,
          nombre,
          autor: payload.autor,
          datos: datosActuales,
        });
        if (Array.isArray(res) && res.length > 0) {
          supabaseId = res[0].id;
          supabaseOK = true;
        }
      } catch (e) {
        console.warn("Fallo al guardar en Supabase:", e.message);
      }
    }
    // Guardar SIEMPRE en localStorage como respaldo
    try {
      await storage.set(key, JSON.stringify(payload));
      // Añadir a la lista según origen
      let nuevoPerfil;
      if (supabaseOK) {
        nuevoPerfil = {
          key: `sup_${supabaseId}`,
          supabaseId,
          proyectoId: proyectoActivoCtx.id,
          fuente: "supabase",
          ...payload,
        };
      } else {
        nuevoPerfil = { key, fuente: "local", ...payload };
      }
      setPerfiles(prev => [nuevoPerfil, ...prev.filter(p => p.key !== nuevoPerfil.key)]);
      setNombrePerfil("");
      setMostrarGuardar(false);
      if (supabaseOK) {
        showMsg(`✓ Guardado en el proyecto: ${nombre}`);
      } else if (proyectoActivoCtx?.id) {
        showMsg(`⚠ Guardado solo local (sin conexión): ${nombre}`, "warn");
      } else {
        showMsg(`✓ Guardado (local): ${nombre}`);
      }
    } catch (e) {
      showMsg("Error al guardar", "error");
      console.error(e);
    }
  };

  const cargarPerfil = (perfil) => {
    onCargarPerfil(perfil.datos);
    setMostrarLista(false);
    showMsg(`✓ Cargado: ${perfil.nombre}`);
  };

  const eliminarPerfil = async (perfil, e) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${perfil.nombre}"?`)) return;
    try {
      if (perfil.fuente === "supabase" && perfil.supabaseId) {
        // v46: borrar de Supabase
        await borrarPerfilSupabase(perfil.supabaseId, esAdmin ? usuarioCtx.pin : null);
      } else {
        await storage.delete(perfil.key);
      }
      setPerfiles(prev => prev.filter(p => p.key !== perfil.key));
      showMsg("✓ Eliminado");
    } catch (err) {
      showMsg("Error al eliminar", "error");
      console.error(err);
    }
  };

  const exportarJSON = () => {
    const partes = [
      datosActuales.proyecto,
      datosActuales.productora,
      datosActuales.nombre,
    ].filter(Boolean).map(s => s.replace(/[^a-zA-Z0-9]/g,"_"));
    const nombreArchivo = (partes.length ? partes.join("_") : "perfil") + `_${tabId}.json`;
    const blob = new Blob([JSON.stringify({ tabId, datos: datosActuales, exportado: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
    showMsg("✓ Descargado");
  };

  const importarJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.datos) { onCargarPerfil(data.datos); showMsg("✓ Importado"); }
        else throw new Error("Formato inválido");
      } catch (err) { showMsg("Archivo inválido", "error"); console.error(err); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const btnStyle = (color = "#1a1a1a", fondo = "#fff") => ({
    padding: "6px 12px", fontSize: 9, fontFamily: "'Courier New', monospace",
    fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    background: fondo, color, border: `1px solid ${color === "#1a1a1a" ? "#d0ccc6" : color}`,
    borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div style={{ background:"#fff", border:"1px solid #e0ddd8", borderRadius:8, padding:14, marginBottom:20, position:"relative" }}>
      <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#b8864a", textTransform:"uppercase", marginBottom:10, paddingBottom:8, borderBottom:"1px solid #e0ddd8" }}>
        ▸ Perfiles Guardados {perfiles.length > 0 && <span style={{ color:"#888", marginLeft:6 }}>({perfiles.length})</span>}
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom: mostrarGuardar || mostrarLista ? 10 : 0 }}>
        <button onClick={() => { setMostrarGuardar(!mostrarGuardar); setMostrarLista(false); }} style={btnStyle("#b8864a")}>💾 Guardar</button>
        <button onClick={() => { setMostrarLista(!mostrarLista); setMostrarGuardar(false); }} style={btnStyle("#1a1a1a")} disabled={cargando}>📋 Cargar {cargando ? "..." : `(${perfiles.length})`}</button>
        <button onClick={exportarJSON} style={btnStyle("#1a1a1a")}>⬇ JSON</button>
        <label style={{ ...btnStyle("#1a1a1a"), display:"inline-block" }}>
          ⬆ Importar
          <input type="file" accept=".json,application/json" onChange={importarJSON} style={{ display:"none" }} />
        </label>
      </div>

      {mensaje && (
        <div style={{ marginTop:8, padding:"6px 10px", borderRadius:4, fontSize:10, fontFamily:"'Courier New',monospace",
          background: mensaje.tipo === "error" ? "#fdf0f0" : "#f0f8f0",
          color: mensaje.tipo === "error" ? "#b02020" : "#2a7a50",
          border: `1px solid ${mensaje.tipo === "error" ? "#e8c0c0" : "#c0e0c0"}` }}>
          {mensaje.texto}
        </div>
      )}

      {mostrarGuardar && (
        <div style={{ marginTop:10, padding:10, background:"#f0ede8", borderRadius:5, border:"1px solid #e0ddd8" }}>
          <div style={{ fontSize:9, color:"#777", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"'Courier New',monospace" }}>Nombre del perfil</div>
          <div style={{ display:"flex", gap:6 }}>
            <input
              type="text"
              value={nombrePerfil}
              placeholder={datosActuales.nombre ? `Ej: ${datosActuales.nombre} · ${datosActuales.puesto}` : "Ej: Juan Pérez · Maquinista 2026"}
              onChange={e => setNombrePerfil(e.target.value)}
              onKeyDown={e => e.key === "Enter" && guardarPerfil()}
              autoFocus
              style={{ flex:1, background:"#fff", border:"1px solid #d0ccc6", borderRadius:4, color:"#1a1a1a", fontFamily:"'Courier New',monospace", fontSize:12, padding:"7px 10px", outline:"none", colorScheme:"light" }}
            />
            <button onClick={guardarPerfil} style={{ ...btnStyle("#fff", "#b8864a"), border:"1px solid #b8864a" }}>Guardar</button>
          </div>
        </div>
      )}

      {mostrarLista && (
        <div style={{ marginTop:10, padding:10, background:"#f0ede8", borderRadius:5, border:"1px solid #e0ddd8", maxHeight:340, overflowY:"auto" }}>
          {/* v46: barra superior admin */}
          {esAdmin && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, paddingBottom:8, borderBottom:"1px solid #e0ddd8" }}>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#666", fontFamily:"'Courier New',monospace", cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={verTodosProyectos}
                  onChange={e => setVerTodosProyectos(e.target.checked)}
                  style={{ cursor:"pointer" }}
                />
                Ver todos los proyectos (admin)
              </label>
              <button
                onClick={() => setMostrarImportador(true)}
                style={{ background:"transparent", color:"#b8864a", border:"1px solid #b8864a", padding:"3px 8px", borderRadius:3, cursor:"pointer", fontSize:9, fontFamily:"'Courier New',monospace", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}
              >📥 Importar antiguos</button>
            </div>
          )}
          {/* v46: aviso si Supabase falló */}
          {huboFallbackSupabase && (
            <div style={{ background:"#fdf0e0", border:"1px solid #e8b878", color:"#7a5a2a", padding:"6px 8px", borderRadius:3, marginBottom:8, fontSize:10, fontFamily:"'Courier New',monospace" }}>
              ⚠ Sin conexión con la nube. Mostrando solo perfiles locales.
            </div>
          )}
          {perfiles.length === 0 ? (
            <div style={{ fontSize:10, color:"#888", textAlign:"center", padding:"12px 0", fontFamily:"'Courier New',monospace" }}>
              No hay perfiles guardados todavía
            </div>
          ) : perfiles.map(perfil => (
            <div key={perfil.key} onClick={() => cargarPerfil(perfil)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"8px 10px", marginBottom:4, background:"#fff", borderRadius:4,
                border:"1px solid #e8e4de", cursor:"pointer", transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#b8864a"; e.currentTarget.style.background = "#fdf8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e4de"; e.currentTarget.style.background = "#fff"; }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#1a1a1a", fontFamily:"'Courier New',monospace", marginBottom:2, display:"flex", alignItems:"center", gap:6 }}>
                  {perfil.nombre}
                  {perfil.tabId && (
                    <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background: perfil.tabId === tabId ? "#e0d0a8" : "#e8e4de", color: perfil.tabId === tabId ? "#7a5a2a" : "#888", letterSpacing:"0.05em", textTransform:"uppercase", fontWeight:700 }}>
                      {perfil.tabId}
                    </span>
                  )}
                  {/* v46: badge fuente */}
                  {perfil.fuente === "local" && (
                    <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background:"#e8e4de", color:"#888", letterSpacing:"0.05em", textTransform:"uppercase", fontWeight:700 }} title="Perfil antiguo (local)">
                      LOCAL
                    </span>
                  )}
                </div>
                <div style={{ fontSize:9, color:"#888", fontFamily:"'Courier New',monospace" }}>
                  {perfil.datos?.proyecto && <><span style={{color:"#b8864a",fontWeight:700}}>📁 {perfil.datos.proyecto}</span>{perfil.datos?.productora ? <span style={{color:"#888"}}> · {perfil.datos.productora}</span> : ""} · </>}
                  {perfil.datos?.nombre || "—"} · {perfil.datos?.puesto || "—"}
                  {perfil.datos?.fechaInicio && ` · ${perfil.datos.fechaInicio}→${perfil.datos.fechaFin}`}
                  <br />
                  <span style={{ color:"#aaa" }}>{new Date(perfil.timestamp).toLocaleString("es-ES")}</span>
                </div>
              </div>
              <button onClick={(e) => eliminarPerfil(perfil, e)}
                style={{ background:"transparent", border:"none", color:"#c08080", fontSize:14, cursor:"pointer", padding:"4px 8px", marginLeft:8 }}
                title="Eliminar">🗑</button>
            </div>
          ))}
        </div>
      )}
      {/* v46: modal importador antiguos (solo admin) */}
      {mostrarImportador && esAdmin && (
        <ImportadorAntiguos
          usuarioActual={usuarioCtx}
          tabId={tabId}
          onCerrar={() => setMostrarImportador(false)}
          onImportado={() => {
            // Refrescar lista tras importar
            setMostrarImportador(false);
            setCargando(true);
            // Forzar re-run del efecto cambiando dependencia artificial no es limpio;
            // más simple: cerrar y reabrir la lista dispara re-mount
            setMostrarLista(false);
            setTimeout(() => setMostrarLista(true), 100);
          }}
        />
      )}
    </div>
  );
}

// ─── TABLA NÓMINA POR MES ────────────────────────────────────────────────────
function TablaMeses({ porMes, vacAcumulada, indemAcumulada, horasAcumuladas, complementosPorMes = [], festivosPorMes = [], valorFestivo = 0 }) {
  if (!porMes || porMes.length === 0) return null;

  const th = (align, extra) => ({
    padding: "7px 8px", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#555", fontWeight: 700, textAlign: align, fontFamily: "'Courier New', monospace",
    borderBottom: "1px solid #e0ddd8", whiteSpace: "nowrap", ...extra,
  });
  const td = (align, color, bold) => ({
    padding: "8px 8px", fontSize: 11, textAlign: align, fontFamily: "'Courier New', monospace",
    color: color || "#1a1a1a", fontWeight: bold ? 600 : 400, borderBottom: "1px solid #eae7e2",
  });

  const Badge = ({ t }) => (
    <span style={{ fontSize: 8, background: "rgba(184,134,74,0.12)", color: "#8a5e20", borderRadius: 3, padding: "1px 4px", marginLeft: 4, letterSpacing: "0.08em", verticalAlign: "middle" }}>{t}</span>
  );
  const Dash = () => <span style={{ color: "#ccc" }}>—</span>;

  const totalCobro = porMes.reduce((s, m) => s + m.cobroMes, 0);
  const totalConExtras = porMes.reduce((s, m, i) => {
    const fest  = (festivosPorMes[i] || 0) * valorFestivo;
    const plus  = complementosPorMes[i] ? complementosPorMes[i].total : 0;
    return s + m.cobroMes + fest + plus;
  }, 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={th("left")}>Mes</th>
            <th style={th("right")}>Fracc.</th>
            <th style={th("right")}>Base €</th>
            <th style={th("right")}>Vac. €{vacAcumulada   && <Badge t="FINAL" />}</th>
            <th style={th("right")}>Indem. €{indemAcumulada && <Badge t="FINAL" />}</th>
            <th style={th("right")}>H.Extra{horasAcumuladas && <Badge t="FINAL" />}</th>
            <th style={th("right")}>H.Extra €{horasAcumuladas && <Badge t="FINAL" />}</th>
            <th style={th("right")}>Vac.Disf.d</th>
            <th style={th("right")}>Vac.Disf. €</th>
            <th style={th("right", { color: "#2a7a50" })}>Comida €</th>
            <th style={th("right", { color: "#b8864a" })}>COBRO MES €</th>
          </tr>
        </thead>
        <tbody>
          {porMes.map((d, i) => {
            const esUlt = i === porMes.length - 1;
            return (
              <tr key={i} style={{ background: esUlt ? "rgba(184,134,74,0.05)" : i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}>
                <td style={td("left", esUlt ? "#d4b88a" : "#aaa")}>
                  <span style={{ textTransform: "capitalize" }}>{d.mes}</span>
                  {!d.esCompleto && <span style={{ fontSize: 8, color: "#3a3a3a", marginLeft: 5 }}>{d.desde}–{d.hasta}</span>}
                </td>
                <td style={td("right", "#555")}>{fmtM(d.fraccion)}</td>
                <td style={td("right")}>{fmt(d.baseMes)}</td>
                <td style={td("right", d.vacShow === 0 ? "#252525" : "#bbb")}>
                  {d.vacShow === 0 ? <Dash /> : fmt(d.vacShow)}
                </td>
                <td style={td("right", d.indemShow === 0 ? "#252525" : "#bbb")}>
                  {d.indemShow === 0 ? <Dash /> : fmt(d.indemShow)}
                </td>
                <td style={td("right", d.importeHxShow === 0 && d.horasExtraMes === 0 ? "#2a2a2a" : "#88a0c0")}>
                  {d.importeHxShow === 0 && d.horasExtraMes === 0 ? <Dash /> : d.horasExtraMes > 0 && !horasAcumuladas ? `${d.horasExtraMes}h` : horasAcumuladas && esUlt ? `${porMes.reduce((s,m)=>s+m.horasExtraMes,0)}h` : <Dash />}
                </td>
                <td style={td("right", d.importeHxShow === 0 ? "#252525" : "#88a0c0")}>
                  {d.importeHxShow === 0 ? <Dash /> : fmt(d.importeHxShow)}
                </td>
                <td style={td("right", d.vacDiasMes === 0 ? "#2a2a2a" : "#c08080")}>
                  {d.vacDiasMes === 0 && !vacAcumulada ? <Dash /> : d.vacDiasMes > 0 && !vacAcumulada ? `${d.vacDiasMes}d` : vacAcumulada && esUlt && porMes.reduce((s,m)=>s+m.vacDiasMes,0) > 0 ? `${porMes.reduce((s,m)=>s+m.vacDiasMes,0)}d` : <Dash />}
                </td>
                <td style={td("right", d.importeVdShow === 0 ? "#252525" : "#c08080")}>
                  {d.importeVdShow === 0 ? <Dash /> : `−${fmt(d.importeVdShow)}`}
                </td>
                {(() => {
                  const comidaMes = complementosPorMes[i] ? complementosPorMes[i].comida : 0;
                  const fest  = (festivosPorMes[i] || 0) * valorFestivo;
                  const plus  = complementosPorMes[i] ? complementosPorMes[i].total : 0;
                  const total = d.cobroMes + fest + plus;
                  return (
                    <>
                      <td style={{ ...td("right", comidaMes > 0 ? "#2a7a50" : "#ccc") }}>
                        {comidaMes > 0
                          ? <>{fmt(comidaMes)}<div style={{fontSize:8,color:"#888"}}>{complementosPorMes[i].diasComida}d × {fmt(complementosPorMes[i].diasComida > 0 ? comidaMes/complementosPorMes[i].diasComida : 0)}€</div></>
                          : <span style={{color:"#ccc"}}>—</span>}
                      </td>
                      <td style={{ ...td("right", "#c8a96e", true), fontSize: 12 }}>
                        {fmt(total)}
                        {(fest > 0 || plus > 0) && (
                          <div style={{ fontSize:9, color:"#999", fontWeight:400 }}>
                            {fmt(d.cobroMes)} sal.
                            {fest > 0 && ` + ${fmt(fest)} fest.`}
                            {plus > 0 && ` + ${fmt(plus)} plus`}
                          </div>
                        )}
                      </td>
                    </>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "rgba(184,134,74,0.06)" }}>
            <td colSpan={2} style={{ ...td("left", "#c8a96e", true), borderTop: "1px solid #d8d4ce", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>TOTAL</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{fmt(porMes.reduce((s,m)=>s+m.baseMes,0))}</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{fmt(porMes.reduce((s,m)=>s+m.vacShow,0))}</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{fmt(porMes.reduce((s,m)=>s+m.indemShow,0))}</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{porMes.reduce((s,m)=>s+m.horasExtraMes,0)}h</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{fmt(porMes.reduce((s,m)=>s+m.importeHxShow,0))}</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>{porMes.reduce((s,m)=>s+m.vacDiasMes,0)}d</td>
            <td style={{ ...td("right", "#888", true), borderTop: "1px solid #d8d4ce" }}>−{fmt(porMes.reduce((s,m)=>s+m.importeVdShow,0))}</td>
            <td style={{ ...td("right", "#5a8a5a", true), borderTop: "1px solid #d8d4ce", fontSize: 13 }}>{complementosPorMes.length ? fmt(complementosPorMes.reduce((s,c)=>s+c.comida,0)) : "—"}</td>
            <td style={{ ...td("right", "#c8a96e", true), borderTop: "1px solid #d8d4ce", fontSize: 13 }}>{fmt(totalConExtras)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── INPUTS POR MES (horas extra y días vacaciones) ─────────────────────────
function InputsPorMes({ desglose, horasPorMes, setHorasPorMes, vacDiasPorMes, setVacDiasPorMes, festivosPorMes, setFestivosPorMes }) {
  if (!desglose || desglose.length === 0) return null;

  const setH = (i,v) => { const a=[...horasPorMes];   a[i]=v; setHorasPorMes(a); };
  const setV = (i,v) => { const a=[...vacDiasPorMes]; a[i]=v; setVacDiasPorMes(a); };
  const setF = (i,v) => { const a=[...(festivosPorMes||[])]; a[i]=v; setFestivosPorMes(a); };

  const totalH = horasPorMes.reduce((s,v)=>s+(v||0),0);
  const totalV = vacDiasPorMes.reduce((s,v)=>s+(v||0),0);
  const totalF = (festivosPorMes||[]).reduce((s,v)=>s+(v||0),0);
  const hasFest = !!setFestivosPorMes;

  const cols = hasFest ? "1fr 56px 56px 56px" : "1fr 70px 70px";

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:cols, gap:6, marginBottom:12, padding:"0 2px 6px", borderBottom:"1px solid #eae7e2" }}>
        <div style={{ fontSize:9, color:"#888", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Courier New',monospace", fontWeight:700 }}>Mes</div>
        <div style={{ fontSize:9, color:"#3a6090", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace", textAlign:"center", fontWeight:700 }}>H.Ext</div>
        <div style={{ fontSize:9, color:"#907060", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace", textAlign:"center", fontWeight:700 }}>Vac</div>
        {hasFest && <div style={{ fontSize:9, color:"#6a4a8a", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace", textAlign:"center", fontWeight:700 }}>Fest</div>}
      </div>

      {desglose.map((d,i) => {
        // Separar "enero de 2026" en mes y año para mostrarlos en 2 líneas
        const partes = d.mes.split(" de ");
        const mesNombre = partes[0] || d.mes;
        const anio = partes[1] || "";
        return (
        <div key={i} style={{ display:"grid", gridTemplateColumns:cols, gap:6, marginBottom:8, alignItems:"center" }}>
          <div style={{ fontFamily:"'Courier New',monospace", lineHeight:1.25, paddingRight:4, paddingTop:11 }}>
            <div style={{ fontSize:10.5, color:"#1a1a1a", fontWeight:600, textTransform:"capitalize", letterSpacing:"0.02em" }}>
              {mesNombre}
            </div>
            <div style={{ fontSize:9, color:"#888", marginTop:1, letterSpacing:"0.03em" }}>
              {anio}{!d.esCompleto && <span style={{ color:"#b8864a", marginLeft:4 }}>({d.desde}–{d.hasta})</span>}
            </div>
          </div>
          {(() => {
            const autoH = Math.round(d.semanasLaborables * 5);
            const valorActual = horasPorMes[i];
            const hasVal = valorActual !== undefined && valorActual !== null && valorActual !== "";
            // Mostrar el valor real (que viene pre-rellenado con el estimado)
            const valorMostrar = hasVal ? valorActual : autoH;
            const esEstimadoOriginal = hasVal && valorActual === autoH;
            return (
              <div style={{ position:"relative", paddingTop:11 }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, fontSize:8, color: esEstimadoOriginal ? "#4a6a9a" : "#8aa0b8", fontFamily:"'Courier New',monospace", letterSpacing:"0.05em", textAlign:"center", pointerEvents:"none", lineHeight:1, fontWeight: esEstimadoOriginal ? 700 : 400 }}>
                  L-V · {autoH}d
                </div>
                <input type="number" min="0" step="0.5"
                  value={valorMostrar}
                  onChange={e=>{
                    const v = e.target.value;
                    const a = [...horasPorMes];
                    a[i] = v === "" ? "" : (parseFloat(v) || 0);
                    setHorasPorMes(a);
                  }}
                  title={`Estimado L-V: ${autoH}h (puedes modificarlo)`}
                  style={{ background: esEstimadoOriginal?"#eef3f8":"#f0ede8", border:`1px solid ${esEstimadoOriginal?"#b8cce0":"#4a6a9a"}`, borderRadius:4, color:"#2a5a8a", fontFamily:"'Courier New',monospace", fontSize:11, padding:"4px 4px", outline:"none", textAlign:"center", colorScheme:"light", minWidth:0, width:"100%", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderColor="#4a6a9a"} onBlur={e=>e.target.style.borderColor=esEstimadoOriginal?"#b8cce0":"#4a6a9a"} />
              </div>
            );
          })()}
          <div style={{ paddingTop:11 }}>
            <input type="number" min="0" step="1" value={vacDiasPorMes[i]||""} placeholder="0"
              onChange={e=>setV(i,parseFloat(e.target.value)||0)}
              style={{ background:"#f0ede8", border:"1px solid #e0c8b0", borderRadius:4, color:"#8a2a20", fontFamily:"'Courier New',monospace", fontSize:11, padding:"4px 4px", outline:"none", textAlign:"center", colorScheme:"light", minWidth:0, width:"100%", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#8a5030"} onBlur={e=>e.target.style.borderColor="#e0c8b0"} />
          </div>
          {hasFest && <div style={{ paddingTop:11 }}>
            <input type="number" min="0" step="1" value={(festivosPorMes||[])[i]||""} placeholder="0"
              onChange={e=>setF(i,parseFloat(e.target.value)||0)}
              style={{ background:"#f0ede8", border:"1px solid #c8b0d8", borderRadius:4, color:"#6a3a9a", fontFamily:"'Courier New',monospace", fontSize:11, padding:"4px 4px", outline:"none", textAlign:"center", colorScheme:"light", minWidth:0, width:"100%", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#8a5aaa"} onBlur={e=>e.target.style.borderColor="#c8b0d8"} />
          </div>}
        </div>
        );
      })}

      <div style={{ display:"grid", gridTemplateColumns:cols, gap:6, marginTop:8, paddingTop:8, borderTop:"1px solid #e0ddd8" }}>
        <div style={{ fontSize:9, color:"#777", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Courier New',monospace", display:"flex", alignItems:"center" }}>Total</div>
        <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#2a5a8a", fontFamily:"'Courier New',monospace" }}>
          {desglose.reduce((s,d,i)=>{
            const v = horasPorMes[i];
            if (v === undefined || v === null || v === "") return s + Math.round(d.semanasLaborables * 5);
            return s + (v || 0);
          },0)}h
        </div>
        <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#8a2a20", fontFamily:"'Courier New',monospace" }}>{totalV}d</div>
        {hasFest && <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#6a3a9a", fontFamily:"'Courier New',monospace" }}>{totalF}d</div>}
      </div>
    </div>
  );
}

// ─── APP 40H ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// MODAL CSV — Muestra el contenido del CSV en un textarea seleccionable
// con botón de copiar al portapapeles. El usuario puede:
//   - Pulsar "Copiar al portapapeles" (usa Clipboard API o execCommand)
//   - Hacer Ctrl+A, Ctrl+C en el textarea
//   - Seleccionar manualmente con el ratón y copiar
// ═══════════════════════════════════════════════════════════════════════
function ModalCSV({ contenido, filename, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const [descargado, setDescargado] = useState(false);

  const copiar = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(contenido);
        setCopiado(true);
      } else {
        const ta = document.getElementById("csv-textarea-export");
        ta.select();
        document.execCommand("copy");
        setCopiado(true);
      }
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      const ta = document.getElementById("csv-textarea-export");
      ta.focus();
      ta.select();
      alert("No pudo copiarse automáticamente. El texto está seleccionado: pulsa Ctrl+C (o Cmd+C en Mac).");
    }
  };

  const descargar = () => {
    try {
      const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDescargado(true);
      setTimeout(() => setDescargado(false), 2500);
    } catch (e) {
      console.error("Error al descargar:", e);
      alert("Error al iniciar la descarga: " + e.message);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 8,
          maxWidth: 900, width: "100%", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          fontFamily: "'Courier New', monospace",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* cabecera */}
        <div style={{
          background: "#1a1a1a", color: "#f0e6d0",
          padding: "14px 20px", borderRadius: "8px 8px 0 0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "2px solid #b8864a",
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#b8864a", textTransform: "uppercase", marginBottom: 2 }}>
              EXPORTAR CSV
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{filename}</div>
          </div>
          <button onClick={onClose}
            style={{ background: "transparent", border: "1px solid #b8864a", color: "#b8864a",
              padding: "6px 14px", fontSize: 11, fontFamily: "'Courier New', monospace",
              fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              borderRadius: 3, cursor: "pointer" }}>
            ✕ Cerrar
          </button>
        </div>

        {/* instrucciones */}
        <div style={{ padding: "12px 20px", background: "#fdf8f0", borderBottom: "1px solid #e0ddd8", fontSize: 11, color: "#555", lineHeight: 1.5 }}>
          <strong style={{ color: "#1a1a1a" }}>3 formas de guardar el CSV:</strong>
          <br/>• <strong>"Descargar archivo"</strong> (recomendado): genera el .csv y lo descarga directamente
          <br/>• <strong>"Copiar al portapapeles"</strong>: pega luego en Excel o Bloc de notas
          <br/>• Selecciona el texto manualmente (Ctrl+A, Ctrl+C)
        </div>

        {/* botones de acción */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #e0ddd8", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={descargar}
            style={{ padding: "8px 16px", background: descargado ? "#2a7a50" : "#b8864a", color: "#fff",
              border: "none", borderRadius: 3, cursor: "pointer", fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              transition: "background 0.2s" }}>
            {descargado ? "✓ Descargado" : "⬇ Descargar archivo"}
          </button>
          <button onClick={copiar}
            style={{ padding: "8px 16px", background: copiado ? "#2a7a50" : "transparent", color: copiado ? "#fff" : "#b8864a",
              border: "1px solid #b8864a", borderRadius: 3, cursor: "pointer", fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              transition: "background 0.2s" }}>
            {copiado ? "✓ Copiado" : "📋 Copiar al portapapeles"}
          </button>
        </div>

        {/* textarea con el CSV */}
        <div style={{ padding: 20, flex: 1, overflow: "hidden" }}>
          <textarea
            id="csv-textarea-export"
            readOnly
            value={contenido}
            onFocus={e => e.target.select()}
            style={{
              width: "100%", height: "50vh",
              fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.5,
              padding: 12, border: "1px solid #d0ccc6", borderRadius: 4,
              background: "#fafaf7", color: "#1a1a1a",
              resize: "none", outline: "none",
              whiteSpace: "pre", overflowX: "auto",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODAL PDF — Vista pantalla completa del documento maquetado
// con CSS @media print que oculta TODO menos el documento al imprimir
// ═══════════════════════════════════════════════════════════════════════
function ModalPDF({ contenidoPrint, onClose, filename = "calculadora_45h.pdf" }) {
  const [estado, setEstado] = useState("preparando"); // preparando | listo | generando | error
  const [mensaje, setMensaje] = useState("Cargando librería PDF…");
  const [logs, setLogs] = useState([]);

  const log = (msg) => {
    console.log("[PDF]", msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // Pre-cargar html2pdf.js al montar el modal
  useEffect(() => {
    const cargar = async () => {
      if (window.html2pdf) {
        log("html2pdf ya estaba cargado");
        setEstado("listo");
        setMensaje("");
        return;
      }
      log("Cargando html2pdf desde CDN…");
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => {
            log("html2pdf cargado correctamente");
            resolve();
          };
          script.onerror = (e) => {
            log("Error al cargar el script: " + (e.message || "evento error"));
            reject(new Error("CDN bloqueado o sin red"));
          };
          document.head.appendChild(script);
        });
        // verificar que la variable global existe
        if (!window.html2pdf) {
          throw new Error("script cargado pero window.html2pdf no está definido");
        }
        setEstado("listo");
        setMensaje("");
      } catch (e) {
        log("FALLO carga librería: " + e.message);
        setEstado("error");
        setMensaje("No se pudo cargar la librería PDF. Usa el botón de impresión del navegador.");
      }
    };
    cargar();
  }, []);

  const generarPDF = async () => {
    setEstado("generando");
    setMensaje("Generando PDF…");
    log("Inicio de generación");
    try {
      if (!window.html2pdf) throw new Error("html2pdf no disponible");

      const elemento = document.getElementById("pdf-doc-content");
      if (!elemento) throw new Error("elemento del documento no encontrado");
      log(`Elemento encontrado: ${elemento.offsetWidth}×${elemento.offsetHeight}px`);

      // Avisar si el elemento es enorme (puede provocar fallos de memoria)
      const estimadoMB = (elemento.offsetWidth * elemento.offsetHeight * 4 * 1.5 * 1.5) / (1024 * 1024);
      log(`Memoria canvas estimada: ~${estimadoMB.toFixed(1)} MB`);
      if (estimadoMB > 80) {
        log("⚠ Documento muy grande, reduciendo escala");
      }

      const scale = estimadoMB > 80 ? 1 : 1.5;

      const opciones = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: "#ffffff",
          letterRendering: true,
          // imageTimeout en ms (importante para imgs grandes en base64)
          imageTimeout: 15000,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        },
      };

      log("Paso 1: html2pdf().set(opciones)…");
      const worker = window.html2pdf().set(opciones).from(elemento);

      log("Paso 2: convertir a canvas…");
      setMensaje("Renderizando contenido…");
      await worker.toCanvas();
      log("✓ Canvas creado");

      log("Paso 3: generar PDF…");
      setMensaje("Construyendo PDF…");
      await worker.toPdf();
      log("✓ PDF en memoria");

      log("Paso 4: obtener Blob…");
      const blob = await worker.output("blob");
      log(`✓ Blob obtenido (${(blob.size / 1024).toFixed(1)} KB)`);

      log("Paso 5: descargar archivo…");
      setMensaje("Descargando…");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      log("✓ Descarga iniciada");
      setEstado("listo");
      setMensaje("✓ PDF generado correctamente");
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      const errMsg = e?.message || String(e);
      log("ERROR: " + errMsg);
      if (e?.stack) log("Stack: " + e.stack.split('\n').slice(0, 3).join(' / '));
      console.error("Error generando PDF:", e);
      setEstado("error");
      setMensaje("Error: " + errMsg);
    }
  };

  // Plan B: imprimir directamente con window.print() (puede que el sandbox lo permita ahora)
  const imprimirNavegador = () => {
    log("Intento window.print() directo");
    try {
      window.print();
    } catch (e) {
      log("window.print falló: " + e.message);
      alert("La impresión nativa también está bloqueada. Solución: copia el contenido del modal y pégalo en un editor.");
    }
  };

  const ocupado = estado === "preparando" || estado === "generando";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex", flexDirection: "column",
        zIndex: 9999,
        fontFamily: "'Courier New', monospace",
      }}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #pdf-doc-content, #pdf-doc-content * { visibility: visible !important; }
          #pdf-doc-content {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important; max-width: none !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* toolbar */}
      <div style={{
        background: "#1a1a1a", color: "#f0e6d0",
        padding: "12px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "2px solid #b8864a",
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#b8864a", textTransform: "uppercase", marginBottom: 2 }}>
            EXPORTAR PDF
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{filename}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {mensaje && (
            <span style={{
              fontSize: 10,
              color: estado === "error" ? "#ff8080" : estado === "listo" && mensaje.startsWith("✓") ? "#80ff80" : "#b8864a",
              fontFamily: "'Courier New', monospace",
              maxWidth: 280,
            }}>
              {mensaje}
            </span>
          )}
          <button
            onClick={generarPDF}
            disabled={ocupado || estado === "error"}
            style={{
              padding: "8px 16px",
              background: ocupado || estado === "error" ? "#444" : "#b8864a",
              color: "#fff", border: "none", borderRadius: 3,
              cursor: ocupado ? "wait" : (estado === "error" ? "not-allowed" : "pointer"),
              fontFamily: "'Courier New', monospace", fontSize: 11,
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              opacity: estado === "error" ? 0.4 : 1,
            }}>
            {estado === "preparando" ? "⏳ Cargando…" : estado === "generando" ? "⏳ Generando…" : "⬇ Descargar PDF"}
          </button>
          <button onClick={imprimirNavegador}
            style={{ padding: "8px 16px", background: "transparent", color: "#b8864a",
              border: "1px solid #b8864a", borderRadius: 3, cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontSize: 11,
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}
            title="Plan B: imprimir con el diálogo del navegador">
            🖨 Imprimir
          </button>
          <button onClick={onClose}
            style={{ padding: "8px 16px", background: "transparent", color: "#888",
              border: "1px solid #888", borderRadius: 3, cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontSize: 11,
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* hint */}
      <div style={{
        padding: "10px 20px", background: "#fdf8f0",
        fontSize: 11, color: "#555", borderBottom: "1px solid #e0ddd8",
      }}>
        {estado === "error" ? (
          <div>
            <strong style={{ color: "#b02020" }}>⚠ La librería PDF no se pudo cargar.</strong>
            <br/>Soluciones:
            <br/>• Pulsa <strong>"🖨 Imprimir"</strong> y elige "Guardar como PDF" en el diálogo del navegador
            <br/>• Haz una captura de pantalla del documento
            <br/>• Si el problema persiste, abre la consola del navegador (F12) y revisa los logs de abajo
          </div>
        ) : (
          <>
            <strong>Para guardar:</strong> pulsa <strong>"⬇ Descargar PDF"</strong> (genera y descarga automáticamente)
            o <strong>"🖨 Imprimir"</strong> (usa el diálogo nativo del navegador → "Guardar como PDF").
          </>
        )}
      </div>

      {/* logs (solo si hay error) */}
      {(estado === "error" || logs.length > 0) && (
        <details style={{ background: "#1a1a1a", color: "#888", padding: "8px 20px", fontSize: 10, fontFamily: "monospace", borderBottom: "1px solid #444" }}>
          <summary style={{ cursor: "pointer", color: "#b8864a", fontWeight: 700 }}>Logs de diagnóstico ({logs.length})</summary>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 9, lineHeight: 1.5 }}>
            {logs.join("\n")}
          </pre>
        </details>
      )}

      {/* área de scroll con el documento */}
      <div style={{
        flex: 1, overflow: "auto", padding: 20, background: "#666",
      }}>
        <div
          id="pdf-doc-content"
          style={{
            background: "#fff",
            maxWidth: "210mm",
            margin: "0 auto",
            padding: "15mm",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            borderRadius: 4,
            color: "#1a1a1a",
            fontSize: 10,
          }}
        >
          {contenidoPrint}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENTO IMPRIMIBLE — el contenido maquetado para PDF
// ═══════════════════════════════════════════════════════════════════════
// === NUEVO DocumentoImprimible — formato del PDF de Teresa Cepeda ===
function DocumentoImprimible({
  logoEmpresa, nombre, puesto, proyecto, productora,
  fechaInicio, fechaFin, salario45efectivo, horasRef,
  p40ref, sumaRef,
  baseRef, vacRef, indemRef, hxRef, vHoraEx, vHora, salarioDia,
  p, desglose45, complementos45,
  vacAcumulada, indemAcumulada,
  horasPorMes, importeVdMes, importeFestMes45,
  totBase, totVac, totIndem,
  totHx, totPlus, totVd,
  totalVdDias, totalCompl,
  totFinal,
  totalVac45, totalIndem45,
  totalFestDias45, totalFestImport45,
  plusHerramienta, plusCoche, plusVivienda, plusSeguroVida, plusComida,
  es40h = false,
  codigoContable = "",
  esFijoDiscontinuo = false, // v47: solo 40H
}) {
  // Estilos reutilizables
  const sectionTitle = {
    marginTop: 14, marginBottom: 6,
    fontSize: 8, fontWeight: 700,
    letterSpacing: "0.18em", textTransform: "uppercase",
    color: "#b8864a", paddingBottom: 2,
  };
  const tdHead = {
    padding: "5px 6px", fontSize: 7,
    letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
    color: "#666", background: "#fff",
    border: "1px solid #d8d4ce",
  };
  const tdCell = (extra = {}) => ({
    padding: "4px 6px", fontSize: 9,
    border: "1px solid #e0ddd8",
    fontFamily: "'Courier New', monospace",
    ...extra,
  });
  const tdLabel = {
    padding: "5px 8px", fontSize: 9,
    background: "#fafaf7",
    border: "1px solid #e0ddd8",
    color: "#1a1a1a",
    fontFamily: "'Courier New', monospace",
  };
  const tdValue = {
    padding: "5px 8px", fontSize: 9,
    border: "1px solid #e0ddd8",
    fontFamily: "'Courier New', monospace",
  };

  const tieneCompl = totalCompl > 0;
  const totalConExtras = totFinal + totalFestImport45 + totalCompl;

  return (
    <div style={{ fontFamily: "'Courier New', monospace", color: "#1a1a1a", fontSize: 10, position: "relative" }}>

      {/* ═══ MARCA DE AGUA "SIMULACRO DE NOMINA" ═══ */}
      {/* Marca única, centrada en la página, en diagonal a -28°.
          Tres líneas: SIMULACRO / DE / NOMINA. Opacidad sutil 0.06.
          z-index alto + pointer-events:none para que quede sobre el
          contenido sin bloquear interacción. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div
          style={{
            transform: "rotate(-28deg)",
            color: "#1a1a1a",
            opacity: 0.06,
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 0.95,
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          <div style={{ fontSize: 110 }}>SIMULACRO</div>
          <div style={{ fontSize: 110 }}>DE</div>
          <div style={{ fontSize: 110 }}>NOMINA</div>
        </div>
      </div>

      {/* Contenido del documento (z-index 1 para quedar SOBRE la marca de agua) */}
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* ═══ CABECERA ═══ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: "45%", verticalAlign: "middle", padding: 0 }}>
              <div style={{ background: "#1a1a1a", padding: "10px 14px", borderRadius: 3, display: "inline-block" }}>
                <div style={{ color: "#c8a96e", fontFamily: "'Courier New',monospace", fontWeight: 700, fontSize: 18, letterSpacing: "0.15em", lineHeight: 1 }}>
                  BD PROD TOOLS
                </div>
              </div>
            </td>
            <td style={{ width: "55%", verticalAlign: "middle", padding: 0, textAlign: "right" }}>
              <div style={{ fontSize: 8, color: "#888", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 3 }}>
                Desglose Salarial · {es40h ? "40 Horas" : "45 Horas"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.05em", color: "#1a1a1a", marginBottom: 5 }}>
                CALCULADORA DE SALARIOS
              </div>
              <div style={{ fontSize: 9, color: "#b8864a", letterSpacing: "0.05em" }}>
                <span style={{ background: "#b8864a", color: "#fff", padding: "1px 4px", marginRight: 4, fontSize: 7 }}>📁</span>
                {(proyecto || "—") + " · " + (productora || "—")}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══ TRABAJADOR ═══ */}
      <div style={sectionTitle}>▸ TRABAJADOR</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
        <tbody>
          <tr>
            <td style={tdLabel}><strong>Proyecto:</strong> {proyecto || "—"}</td>
            <td style={tdValue}><strong>Productora:</strong> {productora || "—"}</td>
          </tr>
          <tr>
            <td style={tdLabel}><strong>Nombre:</strong> {nombre || "—"}</td>
            <td style={tdValue}><strong>Puesto:</strong> {puesto || "—"}{codigoContable ? <span style={{ color: "#888", marginLeft: 6, fontWeight: 400, fontSize: 10 }}>· {codigoContable}</span> : null}</td>
          </tr>
          {!es40h && (
            <tr>
              <td style={tdLabel}><strong>Salario pactado 45h:</strong> <span style={{ color: "#b8864a", fontWeight: 700 }}>{fmtE(salario45efectivo)}</span></td>
              <td style={tdValue}><strong>Horas referencia:</strong> {horasRef}h/mes</td>
            </tr>
          )}
          {/* v47: fila fijo discontinuo (solo 40H) */}
          {es40h && esFijoDiscontinuo && (
            <tr>
              <td colSpan={2} style={{ ...tdLabel, background: "#faf1e0" }}>
                <span style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  background: "#c8963a",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  borderRadius: 3,
                  marginRight: 8,
                }}>FIJO DISCONTINUO</span>
                <span style={{ color: "#7a5a2a", fontSize: 10 }}>
                  Indemnización calculada con factor 1,6433333 (en vez del 0,98632 estándar)
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ═══ REFERENCIA MES COMPLETO ═══ */}
      <div style={sectionTitle}>▸ REFERENCIA MES COMPLETO (40H BASE + HORAS EXTRA)</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
        <tbody>
          <tr>
            {[
              { l: "BASE 40H",      v: baseRef,  s: (es40h && esFijoDiscontinuo) ? "Salario ÷ 1,14190" : "× 0,89286" },
              { l: "VACACIONES",    v: vacRef,   s: "Base ÷ 11,478452" },
              { l: "INDEMNIZACIÓN", v: indemRef, s: (es40h && esFijoDiscontinuo) ? "(Base/30) × 1,6433333" : "(Base/30) × 0,98632" },
              ...(es40h ? [] : [{ l: `H.EXTRA (${horasRef}H)`, v: hxRef, s: `${horasRef}h × ${fmt(vHoraEx)} €`, blue: true }]),
            ].map((it, idx, arr) => (
              <td key={idx} style={{
                width: `${100/arr.length}%`,
                border: "1px solid #e0ddd8",
                padding: "10px 6px",
                textAlign: "center",
                background: "#fafaf7",
              }}>
                <div style={{ fontSize: 7, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 5 }}>{it.l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: it.blue ? "#3a6898" : "#1a1a1a" }}>{fmt(it.v)} €</div>
                <div style={{ fontSize: 7, color: "#aaa", marginTop: 4 }}>{it.s}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {es40h ? (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ background: "#fdf8f0", border: "1px solid #e8d4a8", padding: "7px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", width: "50%" }}>
                  TOTAL MES 40H · <span style={{ color: "#b8864a", fontSize: 12 }}>{fmt(baseRef + vacRef + indemRef)} €</span> <span style={{ display: "inline-block", background: "#b8864a", color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 3, marginLeft: 4, verticalAlign: "middle" }}>BRUTOS</span>
                </td>
                <td style={{ background: "#f0f6fc", border: "1px solid #c8d8e8", padding: "7px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", width: "50%" }}>
                  SALARIO EN CONTRATO · <span style={{ color: "#3a6898", fontSize: 12 }}>{fmt(vacAcumulada ? baseRef : (baseRef + vacRef))} €</span> <span style={{ display: "inline-block", background: "#3a6898", color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 3, marginLeft: 4, verticalAlign: "middle" }}>BRUTOS</span>
                  {vacAcumulada && <div style={{ fontSize: 7.5, color: "#5a7a9a", marginTop: 2, letterSpacing: "0.05em", fontStyle: "italic", fontWeight: 400 }}>Base 40h · vacaciones al final</div>}
                </td>
              </tr>
            </tbody>
          </table>
          {!vacAcumulada && (
            <div style={{ marginTop: 8, padding: "7px 10px", background: "#fafaf7", border: "1px solid #e0ddd8", borderRadius: 3, fontSize: 9, color: "#555", lineHeight: 1.5, fontStyle: "italic" }}>
              <strong style={{ color: "#1a1a1a", fontStyle: "normal" }}>Nota:</strong> Salario en contrato es la suma del salario base + las vacaciones.
            </div>
          )}
        </>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ background: "#fdf8f0", border: "1px solid #e8d4a8", padding: "7px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", width: "50%" }}>
                  TOTAL MES 45H TODO INCLUIDO · <span style={{ color: "#b8864a", fontSize: 12 }}>{fmt(sumaRef)} €</span> <span style={{ display: "inline-block", background: "#b8864a", color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 3, marginLeft: 4, verticalAlign: "middle" }}>BRUTOS</span>
                </td>
                <td style={{ background: "#f0f6fc", border: "1px solid #c8d8e8", padding: "7px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", width: "50%" }}>
                  SALARIO EN CONTRATO · <span style={{ color: "#3a6898", fontSize: 12 }}>{fmt(baseRef + vacRef)} €</span> <span style={{ display: "inline-block", background: "#3a6898", color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 3, marginLeft: 4, verticalAlign: "middle" }}>BRUTOS</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, padding: "7px 10px", background: "#fafaf7", border: "1px solid #e0ddd8", borderRadius: 3, fontSize: 9, color: "#555", lineHeight: 1.5, fontStyle: "italic" }}>
            <strong style={{ color: "#1a1a1a", fontStyle: "normal" }}>Nota:</strong> El salario que figura en contrato es la suma del salario base 40h más las vacaciones.
          </div>
        </>
      )}

      {/* ═══ CÁLCULO DE HORAS ═══ */}
      <div style={sectionTitle}>▸ CÁLCULO DE HORAS</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={tdLabel}><strong>Salario / Día:</strong> {fmtE(salarioDia)}</td>
            <td style={tdLabel}><strong>Salario / Semana:</strong> {fmtE(salarioDia * 7)}</td>
            <td style={tdLabel}><strong>Valor Hora:</strong> {fmtE(vHora)}</td>
          </tr>
          <tr>
            <td style={tdLabel}><strong>Hora Extra ×1,5:</strong> <span style={{ color: "#3a6898" }}>{fmtE(vHoraEx)}</span></td>
            <td style={tdLabel}><strong>Festivo ×1,75:</strong> <span style={{ color: "#6a3a9a" }}>{fmtE(salarioDia * 1.75)}</span></td>
            <td style={tdLabel}><strong>Total H.Extra:</strong> {fmtE(totHx)} ({horasPorMes.reduce((s,v)=>s+(v||0),0)}h)</td>
          </tr>
        </tbody>
      </table>

      {/* ═══ NÓMINA 45H POR MES TRABAJADO ═══ */}
      <div style={sectionTitle}>▸ NÓMINA {es40h ? "40H" : "45H"} POR MES TRABAJADO <span style={{ display: "inline-block", background: "#b8864a", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 3, marginLeft: 8, verticalAlign: "middle", textTransform: "uppercase" }}>Importes Brutos</span></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              { l: "MES", a: "left" },
              { l: "FRAC.", a: "right" },
              { l: "BASE 40H", a: "right" },
              { l: "VAC.", a: "right" },
              { l: "INDEM.", a: "right" },
              { l: "H.EX H", a: "right" },
              { l: "H.EX €", a: "right" },
              ...(es40h ? [] : [{ l: "PLUS ACT.", a: "right" }]),
              { l: "−VAC.D", a: "right" },
              { l: "FEST. €", a: "right" },
              { l: "PLUSES", a: "right" },
              { l: "COMIDA", a: "right" },
              { l: "TOTAL", a: "right", gold: true },
            ].map((h, hi) => (
              <th key={hi} style={{
                padding: "5px 4px", fontSize: 7,
                textAlign: h.a, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700,
                color: h.gold ? "#b8864a" : "#666",
                background: "#fff",
                border: "1px solid #d8d4ce",
              }}>{h.l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {desglose45.map((d, i) => {
            const c = complementos45[i] || {};
            const fest = importeFestMes45[i] || 0;
            const vd   = importeVdMes[i] || 0;
            // PLUSES = total de complementos SIN comida
            const plusesSinComida = (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0) + (c.seguroVida || 0);
            const comida = c.comida || 0;
            // TOTAL = totalMes (que incluye base+vac+indem+h.extra+plusAct−vd) + festivos + complementos
            // En 40H restamos el plusAct del totalMes porque esa columna se elimina
            const totalRow = (es40h ? (d.totalMes - (d.plusAct || 0)) : d.totalMes) + fest + (c.total || 0);
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafaf7" }}>
                <td style={tdCell({ textTransform: "capitalize", fontWeight: 700 })}>
                  {d.mes}
                  {!d.esCompleto && <span style={{ fontSize: 7, color: "#888", marginLeft: 3 }}>({d.desde}-{d.hasta})</span>}
                </td>
                <td style={tdCell({ textAlign: "right", color: "#888" })}>{fmtM(d.fraccion)}</td>
                <td style={tdCell({ textAlign: "right" })}>{fmt(d.base40)}</td>
                <td style={tdCell({ textAlign: "right", color: d.vac40 === 0 ? "#bbb" : "#1a1a1a" })}>{d.vac40 === 0 ? "—" : fmt(d.vac40)}</td>
                <td style={tdCell({ textAlign: "right", color: d.indem40 === 0 ? "#bbb" : "#1a1a1a" })}>{d.indem40 === 0 ? "—" : fmt(d.indem40)}</td>
                <td style={tdCell({ textAlign: "right", color: "#3a6898" })}>{d.hMes}h</td>
                <td style={tdCell({ textAlign: "right", color: "#3a6898" })}>{fmt(d.cobroHx)}</td>
                {!es40h && <td style={tdCell({ textAlign: "right", color: d.plusAct > 0 ? "#b07030" : "#bbb", fontWeight: d.plusAct > 0 ? 600 : 400 })}>{d.plusAct > 0 ? fmt(d.plusAct) : "—"}</td>}
                <td style={tdCell({ textAlign: "right", color: vd > 0 ? "#8a2a20" : "#bbb" })}>{vd > 0 ? `−${fmt(vd)}` : "—"}</td>
                <td style={tdCell({ textAlign: "right", color: fest > 0 ? "#6a3a9a" : "#bbb" })}>{fest > 0 ? fmt(fest) : "—"}</td>
                <td style={tdCell({ textAlign: "right", color: plusesSinComida > 0 ? "#5a8a5a" : "#bbb" })}>{plusesSinComida > 0 ? fmt(plusesSinComida) : "—"}</td>
                <td style={tdCell({ textAlign: "right", color: comida > 0 ? "#5a8a5a" : "#bbb" })}>{comida > 0 ? fmt(comida) : "—"}</td>
                <td style={tdCell({ textAlign: "right", color: "#b8864a", fontWeight: 700 })}>{fmt(totalRow)}</td>
              </tr>
            );
          })}
          {/* Fila TOTAL */}
          <tr style={{ background: "#fdf8f0", fontWeight: 700 }}>
            <td style={tdCell({ background: "#fdf8f0", color: "#b8864a", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 8 })}>TOTAL</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#888" })}>—</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right" })}>{fmt(totBase)}</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right" })}>{fmt(totVac)}</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right" })}>{fmt(totIndem)}</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#3a6898" })}>
              {horasPorMes.reduce((s, v, i) => {
                if (v === undefined || v === null || v === "") return s + Math.round((p?.desglose[i]?.semanasLaborables || 0) * 5);
                return s + (v || 0);
              }, 0)}h
            </td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#3a6898" })}>{fmt(totHx)}</td>
            {!es40h && <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: totPlus > 0 ? "#b07030" : "#bbb" })}>{totPlus > 0 ? fmt(totPlus) : "—"}</td>}
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: totVd > 0 ? "#8a2a20" : "#bbb" })}>{totVd > 0 ? `−${fmt(totVd)}` : "—"}</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: totalFestImport45 > 0 ? "#6a3a9a" : "#bbb" })}>{totalFestImport45 > 0 ? fmt(totalFestImport45) : "—"}</td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#5a8a5a" })}>
              {fmt(complementos45.reduce((s,c)=>s+(c.herramienta||0)+(c.coche||0)+(c.vivienda||0)+(c.seguroVida||0), 0))}
            </td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#5a8a5a" })}>
              {fmt(complementos45.reduce((s,c)=>s+(c.comida||0), 0))}
            </td>
            <td style={tdCell({ background: "#fdf8f0", textAlign: "right", color: "#b8864a" })}>{fmt(es40h ? (totalConExtras - (totPlus || 0)) : totalConExtras)}</td>
          </tr>
        </tbody>
      </table>

      {/* ═══ PERÍODO DE CONTRATACIÓN ═══ */}
      <div style={sectionTitle}>▸ PERÍODO DE CONTRATACIÓN</div>
      {p && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ ...tdLabel, textAlign: "center", padding: "8px" }}><strong>Inicio:</strong> {fechaInicio}</td>
                <td style={{ ...tdValue, textAlign: "center", padding: "8px" }}><strong>Fin:</strong> {fechaFin}</td>
                <td style={{ ...tdLabel, textAlign: "center", padding: "8px" }}><strong>Días:</strong> {p.diasNormalizados}</td>
                <td style={{ ...tdValue, textAlign: "center", padding: "8px" }}><strong>Meses:</strong> {fmtM(p.mesesTotales)}</td>
                <td style={{ ...tdLabel, textAlign: "center", padding: "8px" }}><strong>Sem. L-V:</strong> {fmt(p.semanasTotales, 1)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* ═══ RESUMEN DEL PERÍODO ═══ */}
      <div style={sectionTitle}>▸ RESUMEN DEL PERÍODO <span style={{ display: "inline-block", background: "#b8864a", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 3, marginLeft: 8, verticalAlign: "middle", textTransform: "uppercase" }}>Importes Brutos</span></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={tdLabel}>Base 40h equivalente</td>
            <td style={{ ...tdValue, textAlign: "right", fontWeight: 700 }}>{fmtE(totBase)}</td>
          </tr>
          <tr>
            <td style={{ ...tdLabel, paddingLeft: 18, color: "#666" }}>· Vacaciones</td>
            <td style={{ ...tdValue, textAlign: "right", color: "#666" }}>{fmtE(totalVac45)}</td>
          </tr>
          <tr>
            <td style={{ ...tdLabel, paddingLeft: 18, color: "#666" }}>· Indemnización</td>
            <td style={{ ...tdValue, textAlign: "right", color: "#666" }}>{fmtE(totalIndem45)}</td>
          </tr>
          <tr>
            <td style={tdLabel}>+ Horas extra ({horasPorMes.reduce((s,v)=>s+(v||0),0)}h)</td>
            <td style={{ ...tdValue, textAlign: "right", color: "#3a6898", fontWeight: 700 }}>+ {fmtE(totHx)}</td>
          </tr>
          {totPlus > 0 && !es40h && (
            <tr>
              <td style={tdLabel}>+ Plus de Actividad</td>
              <td style={{ ...tdValue, textAlign: "right", color: "#b07030", fontWeight: 700 }}>+ {fmtE(totPlus)}</td>
            </tr>
          )}
          {totVd > 0 && (
            <tr>
              <td style={tdLabel}>− Vacaciones disfrutadas ({totalVdDias}d)</td>
              <td style={{ ...tdValue, textAlign: "right", color: "#8a2a20", fontWeight: 700 }}>− {fmtE(totVd)}</td>
            </tr>
          )}
          {totalFestDias45 > 0 && (
            <tr>
              <td style={tdLabel}>+ Festivos trabajados ({totalFestDias45}d)</td>
              <td style={{ ...tdValue, textAlign: "right", color: "#6a3a9a", fontWeight: 700 }}>+ {fmtE(totalFestImport45)}</td>
            </tr>
          )}
          <tr style={{ background: "#fdf8f0" }}>
            <td style={{ ...tdLabel, background: "#fdf8f0", color: "#b8864a", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 10, padding: "8px 8px" }}>
              TOTAL A PERCIBIR ({es40h ? "40h" : "45h"}) {tieneCompl ? "(sin extras)" : ""} <span style={{ display: "inline-block", background: "#b8864a", color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", padding: "1px 6px", borderRadius: 3, marginLeft: 6, verticalAlign: "middle", textTransform: "uppercase" }}>Importe Bruto</span>
            </td>
            <td style={{ ...tdValue, background: "#fdf8f0", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#b8864a", padding: "8px 8px" }}>
              {fmtE(es40h ? (totFinal - (totPlus || 0)) : totFinal)}
            </td>
          </tr>
          <tr>
            <td style={{ ...tdLabel, paddingLeft: 18, color: "#666" }}>· Promedio mensual ({fmtM(p?.mesesTotales || 0)} meses)</td>
            <td style={{ ...tdValue, textAlign: "right", color: "#1a7a58", fontWeight: 700 }}>{p && p.mesesTotales > 0 ? fmtE((es40h ? (totFinal - (totPlus || 0)) : totFinal) / p.mesesTotales) : "—"}</td>
          </tr>
          <tr>
            <td style={{ ...tdLabel, paddingLeft: 18, color: "#666" }}>· Promedio semanal ({fmt(p?.semanasTotales || 0, 1)} sem L-V)</td>
            <td style={{ ...tdValue, textAlign: "right", color: "#1a7a58" }}>{p && p.semanasTotales > 0 ? fmtE((es40h ? (totFinal - (totPlus || 0)) : totFinal) / p.semanasTotales) : "—"}</td>
          </tr>

          {/* EXTRAS DEL PERÍODO */}
          {tieneCompl && (
            <>
              <tr>
                <td colSpan={2} style={{
                  padding: "6px 8px", textAlign: "center", fontSize: 8,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  background: "#fafaf7", color: "#888", fontWeight: 700,
                  border: "1px solid #e0ddd8",
                }}>
                  EXTRAS DEL PERÍODO
                </td>
              </tr>
              <tr>
                <td style={tdLabel}>+ Complementos (pluses)</td>
                <td style={{ ...tdValue, textAlign: "right", color: "#5a8a5a", fontWeight: 700 }}>+ {fmtE(totalCompl)}</td>
              </tr>
              <tr style={{ background: "#1a1a1a" }}>
                <td style={{
                  padding: "10px 8px", color: "#f0c878", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 11,
                  border: "1px solid #1a1a1a",
                }}>
                  TOTAL CON EXTRAS
                </td>
                <td style={{
                  padding: "10px 8px", textAlign: "right",
                  fontSize: 14, fontWeight: 700, color: "#f0c878",
                  border: "1px solid #1a1a1a",
                  fontFamily: "'Courier New', monospace",
                }}>
                  {fmtE(totalConExtras)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Aviso orientativo */}
      <div style={{ marginTop: 16, padding: "10px 14px", background: "#fafaf7", border: "1px solid #e0ddd8", borderRadius: 4, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.02em", lineHeight: 1.5 }}>
        Cálculo orientativo del salario mensual bruto, que puede diferir ligeramente de la nómina real generada en cada periodo.
      </div>

      {/* ═══ PIE ═══ */}
      <div style={{ marginTop: 22, paddingTop: 10, borderTop: "1px solid #e0ddd8", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          BD PROD TOOLS · DESIGNED BY EUGENIO PEREZ · ALL RIGHTS RESERVED
        </div>
        <div style={{ fontSize: 7, color: "#aaa", letterSpacing: "0.03em", marginBottom: 3 }}>
          {DISCLAIMER_PDF}
        </div>
        <div style={{ fontSize: 7, color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          BD PROD TOOLS · Generado el {new Date().toLocaleString("es-ES")}
        </div>
      </div>

      </div>
    </div>
  );
}


function App45({ modoTab = "iruna45" }) {
  // Usuario actual de la sesión (para mostrar autor en exports)
  const usuarioSesion = useContext(UsuarioContext);
  const proyectoActivoCtx = useContext(ProyectoContext); // v45

  // === FLAG PESTAÑA 40H ===
  // Cuando es40h=true, varios textos y bloques cambian para reflejar la jornada de 40h
  const es40h = modoTab === "tab40";
  const labelHoras = es40h ? "40h" : "45h";
  const labelHorasUpper = es40h ? "40H" : "45h";
  const labelTotalRef = es40h ? "TOTAL ≈ 40" : "TOTAL ≈ P45";

  const [proyecto,         setProyecto]       = useState(proyectoActivoCtx?.nombre || "");
  const [productora,       setProductora]     = useState(proyectoActivoCtx?.productora || "");
  const [logoEmpresa,      setLogoEmpresa]    = useState("bizkaia");
  const [nombre,           setNombre]          = useState("");
  const [puesto,           setPuesto]          = useState("");
  const [codigoContable,   setCodigoContable]  = useState("");
  const [esFijoDiscontinuo, setEsFijoDiscontinuo] = useState(false); // v47: solo 40H
  const [salario45,        setSalario45]       = useState("");
  const [horasRef,         setHorasRef]        = useState(22);
  const [modoInverso45,    setModoInverso45]   = useState(false);
  const [objetivoSemanal45,setObjetivoSemanal45]=useState(1500);
  const [fechaInicio,      setFechaInicio]     = useState("2026-01-05");
  const [fechaFin,         setFechaFin]        = useState("2026-03-20");
  const [horasPorMes,      setHorasPorMes]     = useState([]);
  const [vacDiasPorMes,    setVacDiasPorMes]   = useState([]);
  const [festivosPorMes,   setFestivosPorMes]  = useState([]);
  const [festivosActivos,  setFestivosActivos] = useState({});
  const [vacAcumulada,     setVacAcumulada]    = useState(false);
  const [indemAcumulada,   setIndemAcumulada]  = useState(false);
  const [plusHerramienta,  setPlusHerramienta] = useState({ importe: 0, modo: "mes" });
  const [plusCoche,        setPlusCoche]       = useState({ importe: 0, modo: "mes" });
  const [plusVivienda,     setPlusVivienda]    = useState({ importe: 0, modo: "mes" });
  const [plusSeguroVida,   setPlusSeguroVida]  = useState({ importe: 0 });
  const [plusComida,       setPlusComida]      = useState({ importeDia: 0 });
  const [comidaDiasPorMes, setComidaDiasPorMes]= useState([]);

  // === Estados para los modales de exportación ===
  const [modalCSV, setModalCSV]   = useState(null);  // { contenido, filename } o null
  const [exportError, setExportError] = useState(null); // mensaje de error visible
  const [modalPDF, setModalPDF]   = useState(false); // boolean: mostrar vista PDF en pantalla completa

  const [periodo, setPeriodo] = useState(null);

  useEffect(() => {
    const p = calcularPeriodo(fechaInicio, fechaFin);
    setPeriodo(p);
    if (p) {
      const n = p.desglose.length;
      // horasPorMes: pre-rellenar con estimado de días L-V × 5 (modificable)
      setHorasPorMes(prev => Array.from({ length: n }, (_, i) => {
        // Si ya había un valor previo (incluye 0 explícito y números), respetarlo
        if (prev[i] !== undefined && prev[i] !== null && prev[i] !== "") return prev[i];
        // Si no, calcular estimado L-V × 5
        return Math.round((p.desglose[i]?.semanasLaborables || 0) * 5);
      }));
      setVacDiasPorMes(prev    => Array.from({ length: n }, (_, i) => prev[i] ?? 0));
      setComidaDiasPorMes(prev => Array.from({ length: n }, (_, i) => prev[i] ?? null));
    }
  }, [fechaInicio, fechaFin]);

  const p = periodo;

  const FACTOR_HX = FACTOR_BASE / 30 * 7 / 40 * 1.5;

  const K_BASE_45 = FACTOR_BASE * (1 + 1/DIVISOR_VAC + FACTOR_INDEM_DIA/30);
  const p45Inverso = (() => {
    if (!p || !modoInverso45 || !(horasRef > 0)) return null;
    const divRef = 1 + FACTOR_HX * horasRef;
    const K_total = p.desglose.reduce((sum, d, i) => {
      const H = horasPorMes[i] || 0;
      const k = Math.max((d.fraccion * K_BASE_45 + FACTOR_HX * H) / divRef, d.fraccion);
      return sum + k;
    }, 0);
    if (K_total <= 0) return null;
    return (objetivoSemanal45 * p.semanasTotales) / K_total;
  })();
  const salario45efectivo = modoInverso45 && p45Inverso ? p45Inverso : (Number(salario45) || 0);

  const divisorRef = 1 + FACTOR_HX * (horasRef || 1);
  const p40ref     = salario45efectivo / divisorRef;

  // ===== CÁLCULO BASE / VAC / INDEM =====
  // En 45H: Base = P40 × 0,89286 (factor jornada 40/45)
  // En 40H: Base = Salario_pactado / 1,119996 (descomposición directa)
  // v47: en 40H con fijo discontinuo, cambia el factor de indemnización (1,6433333 en vez de 0,98632)
  // y también el divisor 40H para que Base + Vac + Indem siga dando el salario pactado
  const factorIndemActivo = (es40h && esFijoDiscontinuo) ? FACTOR_INDEM_FIJO_DISC : FACTOR_INDEM_DIA;
  const DIVISOR_40H_ACTIVO = 1 + 1/DIVISOR_VAC + factorIndemActivo/30;
  const baseRef    = es40h
    ? (Number(salario45) || 0) / DIVISOR_40H_ACTIVO
    : p40ref * FACTOR_BASE;
  const vacRef     = baseRef / DIVISOR_VAC;
  const indemRef   = (baseRef / 30) * factorIndemActivo;
  const vHora      = (baseRef / 30 * 7) / 40;
  const vHoraEx    = vHora * 1.5;
  const hxRef      = vHoraEx * (horasRef || 0);
  // sumaRef solo se usa en 45H (incluye h.extra). En 40H no aplica
  const sumaRef    = baseRef + vacRef + indemRef + hxRef;
  const salarioDia = baseRef / 30;

  const rawMes45 = p ? p.desglose.map((d, i) => ({
    vac40:   vacRef   * d.fraccion,
    indem40: indemRef * d.fraccion,
  })) : [];
  const totalVac45   = rawMes45.reduce((s,m)=>s+m.vac40,   0);
  const totalIndem45 = rawMes45.reduce((s,m)=>s+m.indem40, 0);

  const importeVdMes  = p ? p.desglose.map((d,i) => (vacDiasPorMes[i]||0) * salarioDia) : [];
  const totalVdImporte= importeVdMes.reduce((s,v)=>s+v, 0);
  const totalVdDias   = vacDiasPorMes.reduce((s,v)=>s+(v||0), 0);

  const n = p ? p.desglose.length : 0;
  const horasParaMes = (i, d) => {
    const v = horasPorMes[i];
    if (v === undefined || v === null || v === "") {
      return Math.round((d?.semanasLaborables || 0) * 5);
    }
    return v || 0;
  };
  const desglose45 = p ? p.desglose.map((d, i) => {
    const hMes      = horasParaMes(i, d);
    const esUltimo  = i === n - 1;
    const vacNat    = vacRef   * d.fraccion;
    const indemNat  = indemRef * d.fraccion;
    const base40  = baseRef * d.fraccion;
    const vac40   = vacAcumulada  ? (esUltimo ? totalVac45   : 0) : vacNat;
    const indem40 = indemAcumulada? (esUltimo ? totalIndem45 : 0) : indemNat;
    const cobroHx = vHoraEx * hMes;
    const cobroNatural = base40 + vacNat + indemNat + cobroHx;
    const objetivo     = salario45efectivo * d.fraccion;
    const plusAct      = Math.max(0, objetivo - cobroNatural);
    const vdShow   = vacAcumulada ? (esUltimo ? totalVdImporte : 0) : (importeVdMes[i]||0);
    const totalMes = base40 + vac40 + indem40 + cobroHx + plusAct - vdShow;
    return {
      mes: d.mes, desde: d.desde, hasta: d.hasta,
      esCompleto: d.esCompleto, fraccion: d.fraccion,
      semanasLab: d.semanasLaborables,
      hMes, base40, vac40, indem40, cobroHx, plusAct,
      vdDias: vacDiasPorMes[i]||0, vdShow,
      objetivo, totalMes,
    };
  }) : [];

  const totBase   = desglose45.reduce((s,d)=>s+d.base40,   0);
  const totVac    = desglose45.reduce((s,d)=>s+d.vac40,    0);
  const totIndem  = desglose45.reduce((s,d)=>s+d.indem40,  0);
  const totHx     = desglose45.reduce((s,d)=>s+d.cobroHx,  0);
  const totPlus   = desglose45.reduce((s,d)=>s+d.plusAct,  0);
  const totVd     = desglose45.reduce((s,d)=>s+d.vdShow,   0);
  const totFinal  = desglose45.reduce((s,d)=>s+d.totalMes, 0);

  const complementos45 = p ? p.desglose.map((d, i) => {
    const calcPlus = (plus) => !plus.importe ? 0 :
      plus.modo === "sem" ? plus.importe * d.semanasLaborables : plus.importe * d.fraccion;
    const herramienta = calcPlus(plusHerramienta);
    const coche       = calcPlus(plusCoche);
    const vivienda    = calcPlus(plusVivienda);
    const seguroVida  = (plusSeguroVida.importe || 0) * d.fraccion;
    const diasLV      = Math.round(d.semanasLaborables * 5);
    const diasComida  = (comidaDiasPorMes[i] !== null && comidaDiasPorMes[i] !== undefined) ? (comidaDiasPorMes[i]||0) : diasLV;
    const comida      = (plusComida.importeDia||0) * diasComida;
    const total       = herramienta + coche + vivienda + seguroVida + comida;
    return { herramienta, coche, vivienda, seguroVida, comida, diasComida, diasLV, total };
  }) : [];
  const totalCompl = complementos45.reduce((s,c)=>s+c.total, 0);

  const importeFestMes45 = p ? p.desglose.map((_,i)=>(festivosPorMes[i]||0)*salarioDia*1.75) : [];
  const totalFestDias45  = festivosPorMes.reduce((s,v)=>s+(v||0),0);
  const totalFestImport45= importeFestMes45.reduce((s,v)=>s+v,0);

  // ── EXPORTAR CSV (45h) - genera contenido y abre modal ───────────────
  const exportarCSV45 = () => {
    if (!p || desglose45.length === 0) return;
    const sep = ";";
    const decimal = (n) => parseFloat(n).toFixed(2).replace(".", ",");
    const lines = [];

    lines.push([`CALCULADORA SALARIAL · ${es40h ? "40 HORAS" : "45 HORAS"}`].join(sep));
    if (usuarioSesion) {
      const fechaGen = new Date().toLocaleString("es-ES");
      lines.push(["Generado por", `${usuarioSesion.nombre} · ${fechaGen}`].join(sep));
    }
    lines.push([""].join(sep));
    lines.push(["Proyecto", proyecto || "—"].join(sep));
    lines.push(["Productora", productora || "—"].join(sep));
    lines.push(["Trabajador", nombre || "—"].join(sep));
    lines.push(["Puesto", puesto || "—"].join(sep));
    lines.push(["Código Contable", codigoContable || "—"].join(sep));
    lines.push(["Período", `${fechaInicio} → ${fechaFin}`].join(sep));
    lines.push([`Salario pactado ${es40h ? "40h" : "45h"} (€/mes)`, decimal(salario45efectivo)].join(sep));
    if (!es40h) lines.push(["Horas extra de referencia (h/mes)", horasRef].join(sep));
    lines.push(["P40 equivalente (€/mes)", decimal(p40ref)].join(sep));
    lines.push(["Días normalizados", p.diasNormalizados].join(sep));
    lines.push(["Meses totales", decimal(p.mesesTotales)].join(sep));
    lines.push(["Semanas L-V totales", decimal(p.semanasTotales)].join(sep));
    lines.push([""].join(sep));

    lines.push(["MODOS DE PAGO"].join(sep));
    lines.push(["Vacaciones", vacAcumulada ? "Acumuladas al final" : "Prorrateadas"].join(sep));
    lines.push(["Indemnización", indemAcumulada ? "Acumuladas al final" : "Prorrateadas"].join(sep));
    lines.push([""].join(sep));

    lines.push(["REFERENCIA MES COMPLETO"].join(sep));
    lines.push(["Base 40h (€)", decimal(baseRef)].join(sep));
    lines.push(["Vacaciones (€)", decimal(vacRef)].join(sep));
    lines.push(["Indemnización (€)", decimal(indemRef)].join(sep));
    if (!es40h) lines.push([`H.Extra (${horasRef}h) (€)`, decimal(hxRef)].join(sep));
    lines.push([`Total ≈ ${es40h ? "40" : "P45"} (€)`, decimal(es40h ? (baseRef + vacRef + indemRef) : sumaRef)].join(sep));
    lines.push([""].join(sep));

    lines.push(["VALORES DE CÁLCULO"].join(sep));
    lines.push(["Salario / día (€)", decimal(salarioDia)].join(sep));
    lines.push(["Salario / semana (€)", decimal(salarioDia * 7)].join(sep));
    lines.push(["Valor hora (€)", decimal(vHora)].join(sep));
    lines.push(["Hora extra ×1,5 (€)", decimal(vHoraEx)].join(sep));
    lines.push(["Festivo ×1,75 (€)", decimal(salarioDia * 1.75)].join(sep));
    lines.push([""].join(sep));

    lines.push(["NÓMINA POR MES"].join(sep));
    const headers = [
      "Mes","Fracción","Base 40h €","Vacaciones €","Indemnización €",
      "H.Extra (h)","H.Extra €",
      ...(es40h ? [] : ["Plus Actividad €"]),
      "Vac. disfr. (días)","Vac. disfr. €",
      "Festivos (días)","Festivos €",
      "Plus Herramienta €","Plus Coche €","Plus Vivienda €",
      "Plus Seguro Vida €","Días comida","Plus Comida €",
      "Total mes (€)","Complementos mes (€)","Total mes + complementos (€)"
    ];
    lines.push(headers.join(sep));
    desglose45.forEach((d, i) => {
      const c = complementos45[i] || {};
      const totalMesAjustado = es40h ? (d.totalMes - (d.plusAct || 0)) : d.totalMes;
      lines.push([
        d.mes + (d.esCompleto ? "" : ` (${d.desde}-${d.hasta})`),
        decimal(d.fraccion),
        decimal(d.base40),
        decimal(d.vac40),
        decimal(d.indem40),
        d.hMes,
        decimal(d.cobroHx),
        ...(es40h ? [] : [decimal(d.plusAct)]),
        d.vdDias,
        decimal(d.vdShow),
        festivosPorMes[i] || 0,
        decimal(importeFestMes45[i] || 0),
        decimal(c.herramienta || 0),
        decimal(c.coche || 0),
        decimal(c.vivienda || 0),
        decimal(c.seguroVida || 0),
        c.diasComida || 0,
        decimal(c.comida || 0),
        decimal(totalMesAjustado),
        decimal(c.total || 0),
        decimal(totalMesAjustado + (c.total || 0)),
      ].join(sep));
    });
    lines.push([""].join(sep));

    lines.push(["TOTALES"].join(sep));
    lines.push(["Base 40h (€)", decimal(totBase)].join(sep));
    lines.push(["Vacaciones (€)", decimal(totVac)].join(sep));
    lines.push(["Indemnización (€)", decimal(totIndem)].join(sep));
    lines.push([`H.Extra totales (${horasPorMes.reduce((s,v)=>s+(v||0),0)}h) €`, decimal(totHx)].join(sep));
    if (totPlus > 0 && !es40h) lines.push(["Plus Actividad (€)", decimal(totPlus)].join(sep));
    if (totVd > 0)   lines.push([`− Vac. disfrutadas (${totalVdDias}d) €`, decimal(totVd)].join(sep));
    if (totalFestDias45 > 0) lines.push([`+ Festivos trabajados (${totalFestDias45}d) €`, decimal(totalFestImport45)].join(sep));
    if (totalCompl > 0)      lines.push(["+ Complementos (€)", decimal(totalCompl)].join(sep));
    const totFinalAjustado = es40h ? (totFinal - (totPlus || 0)) : totFinal;
    lines.push(["TOTAL A PERCIBIR (€)", decimal(totFinalAjustado + totalFestImport45 + totalCompl)].join(sep));
    lines.push(["Promedio mensual (€)", decimal(totFinalAjustado / p.mesesTotales)].join(sep));
    lines.push(["Promedio semanal (€)", decimal(totFinalAjustado / p.semanasTotales)].join(sep));
    lines.push([""].join(sep));
    lines.push([DISCLAIMER_PDF].join(sep));

    const csv = "\uFEFF" + lines.join("\n");
    const partes = [proyecto, productora, nombre].filter(Boolean).map(s => s.replace(/[^a-zA-Z0-9]/g, "_"));
    const filename = (partes.length ? partes.join("_") : "calculadora") + (es40h ? "_40h.csv" : "_45h.csv");

    // Abrir modal con el contenido del CSV
    setModalCSV({ contenido: csv, filename });

    // Registrar log de exportación
    if (usuarioSesion) {
      const detalle = [proyecto, productora, nombre].filter(Boolean).join(" | ") || "(sin datos)";
      registrarLog(usuarioSesion.nombre, "export_csv", `[${modoTab === "tab40" ? "40H" : "45H"}] ${filename} · ${detalle}`);
    }
  };

  // ── EXPORTAR PDF (45h) - muestra vista print y dispara window.print ──
  const exportarPDF45 = () => {
    setExportError(null);
    try {
      if (!p || desglose45.length === 0) {
        setExportError("Introduce primero las fechas y datos para generar el documento.");
        return;
      }

      // Leer el HTML del componente DocumentoImprimible
      const docElement = document.getElementById("doc-imprimible-oculto");
      if (!docElement) {
        setExportError("No se encuentra el contenido del documento. Recarga la página y vuelve a intentarlo.");
        return;
      }
      const docHTML = docElement.innerHTML;
      if (!docHTML || docHTML.length < 100) {
        setExportError("El documento aún no se ha renderizado completamente. Espera 1 segundo y vuelve a intentarlo.");
        return;
      }

      const partes = [proyecto, productora, nombre].filter(Boolean).map(s => s.replace(/[^a-zA-Z0-9]/g, "_"));
      const baseFilename = partes.length ? partes.join("_") : "calculadora";
      const titulo = [proyecto, productora, nombre].filter(Boolean).join(" - ") || "Calculadora 45h";
      // Nombre para el diálogo "Guardar como PDF" (el navegador usa document.title como sugerencia)
      const tituloPDF = baseFilename + (es40h ? "_40h" : "_45h");

      // Plantilla HTML completa
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${tituloPDF}</title>
<style>
  body {
    background: #fff;
    margin: 0;
    padding: 8mm 10mm;
    font-family: 'Courier New', monospace;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 10px;
  }
  .toolbar {
    position: fixed;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    z-index: 9999;
  }
  .toolbar button {
    background: #1a1a1a;
    color: #f5ead8;
    border: none;
    border-radius: 5px;
    padding: 10px 18px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .toolbar button:hover { background: #b8864a; }
  .info {
    background: #fdf8f0;
    border: 1px solid #e0ddd8;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 11px;
    color: #555;
    line-height: 1.5;
  }
  .info b { color: #b8864a; }
  .autor-box {
    text-align: right;
    font-size: 9px;
    color: #888;
    padding: 4px 0;
    margin-bottom: 8px;
    border-bottom: 1px dotted #d0ccc6;
    letter-spacing: 0.05em;
  }
  .autor-box b { color: #1a1a1a; }

  /* === BORDES DE TABLAS EN PDF === */
  /* Garantiza que todas las tablas tengan bordes visibles al imprimir */
  table {
    border-collapse: collapse !important;
    width: 100%;
  }
  table, table th, table td {
    border: 1px solid #c0bcb5 !important;
  }
  table th {
    border-bottom: 1.5px solid #888 !important;
  }
  /* Pequeñas excepciones: tablas dentro de cards (header del documento, etc.)
     mantienen su look pero con bordes más sutiles */
  table th, table td {
    padding: 5px 7px !important;
  }

  @media print {
    .toolbar, .info { display: none !important; }
    body { padding: 0; }
    @page { size: A4 portrait; margin: 8mm 10mm; }
    /* Forzar que los bordes se impriman aunque el navegador intente optimizarlos */
    table, table th, table td {
      border: 1px solid #888 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="guardarHTML()">💾 Guardar HTML</button>
  <button onclick="window.print()">⎙ Imprimir / Guardar PDF</button>
  <button onclick="window.close()">✕ Cerrar</button>
</div>
<div class="info">
  <b>📄 Versión imprimible — ${titulo}</b><br>
  <b>Guardar HTML</b>: descarga esta página como archivo <code>.html</code> (para archivar o compartir).<br>
  <b>Imprimir / Guardar PDF</b>: abre el diálogo del navegador; elige "Guardar como PDF" como destino.<br>
  <b>Ajustes recomendados:</b> Márgenes Por defecto · Escala Predeterminado · Activa "Gráficos en segundo plano".
</div>
${usuarioSesion ? `<div class="autor-box">Generado por <b>${usuarioSesion.nombre}</b> · ${new Date().toLocaleString("es-ES")}</div>` : ""}
${docHTML}
<script>
  // Guardar la página actual como archivo HTML
  function guardarHTML() {
    try {
      var html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = ${JSON.stringify(baseFilename + (es40h ? "_40h.html" : "_45h.html"))};
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    } catch(e) { alert("No se pudo guardar el HTML: " + e.message); }
  }
</script>
</body>
</html>`;

      // Abrir en nueva ventana (SIN auto-print, el usuario elige con los botones)
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const nuevaVentana = window.open(url, "_blank");
      if (!nuevaVentana) {
        // Bloqueado por popup: fallback a descarga
        const a = document.createElement("a");
        a.href = url;
        a.download = baseFilename + (es40h ? "_40h.html" : "_45h.html");
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setExportError({ tipo: "aviso", mensaje: "⚠ El navegador bloqueó la ventana emergente. Se ha descargado el HTML. Permite ventanas emergentes para esta web y el PDF se abrirá directamente." });
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      // Confirmación visual breve
      setExportError({ tipo: "ok", mensaje: `✓ Descargando: ${baseFilename}${es40h ? "_40h.html" : "_45h.html"}` });
      setTimeout(() => setExportError(null), 4000);

      // Registrar log de exportación
      if (usuarioSesion) {
        const detalle = [proyecto, productora, nombre].filter(Boolean).join(" | ") || "(sin datos)";
        registrarLog(usuarioSesion.nombre, "export_pdf", `[${modoTab === "tab40" ? "40H" : "45H"}] ${baseFilename}${es40h ? "_40h.html" : "_45h.html"} · ${detalle}`);
      }
    } catch (e) {
      console.error("Error al exportar:", e);
      setExportError("Error al generar el archivo: " + (e?.message || String(e)));
    }
  };

  return (
    <div style={{ color:"#1a1a1a", fontFamily:"'Courier New',monospace", padding:"32px 32px" }}>

      {/* Header */}
      
      {/* Header */}
      <div style={{ maxWidth:1400, margin:"0 auto 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                      background:"#1a1a1a", borderRadius:8, padding:"16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background:"#c8a96e", color:"#1a1a1a", padding:"10px 16px", borderRadius:4, fontFamily:"'Courier New',monospace", fontWeight:700, fontSize:16, letterSpacing:"0.15em" }}>
              BD PROD TOOLS
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, letterSpacing:"0.25em", color:"#b8864a", textTransform:"uppercase", marginBottom:4 }}>Desglose Salarial · {es40h ? "40 Horas" : "45 Horas"}</div>
            <div style={{ fontSize:18, fontWeight:700, letterSpacing:"0.07em", color:"#f0e6d0", fontFamily:"'Courier New',monospace" }}>CALCULADORA DE SALARIOS</div>
            {(nombre||puesto) && <div style={{ fontSize:12, color:"#b8864a", marginTop:4, fontFamily:"'Courier New',monospace" }}>{[nombre,puesto].filter(Boolean).join(" · ")}</div>}
            <div className="no-print" style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
              <button
                onClick={exportarCSV45}
                disabled={!p || desglose45.length === 0}
                style={{
                  padding: "6px 12px", fontSize: 9, fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 3,
                  cursor: (p && desglose45.length) ? "pointer" : "not-allowed", fontWeight: 700,
                  border: "1px solid #b8864a",
                  background: (p && desglose45.length) ? "#b8864a" : "transparent",
                  color: (p && desglose45.length) ? "#fff" : "#666",
                  opacity: (p && desglose45.length) ? 1 : 0.5,
                }}
                title="Descargar nómina como CSV (Excel)"
              >⬇ CSV</button>
              <button
                onClick={exportarPDF45}
                disabled={!p || desglose45.length === 0}
                style={{
                  padding: "6px 12px", fontSize: 9, fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 3,
                  cursor: (p && desglose45.length) ? "pointer" : "not-allowed", fontWeight: 700,
                  border: "1px solid #b8864a",
                  background: (p && desglose45.length) ? "#b8864a" : "transparent",
                  color: (p && desglose45.length) ? "#fff" : "#666",
                  opacity: (p && desglose45.length) ? 1 : 0.5,
                }}
                title="Abrir vista de PDF (Guardar HTML / Imprimir / Cerrar)"
              >🖨 PDF</button>
            </div>
          </div>
        </div>
      </div>

      <div className="print-grid" style={{ maxWidth:1400, margin:"0 auto", display:"grid", gridTemplateColumns:"340px minmax(0, 1fr)", gap:20 }}>

        {/* COLUMNA IZQUIERDA */}
        <div className="no-print">

          <GestorPerfiles
            tabId={modoTab === "tab40" ? "40h" : "45h"}
            datosActuales={{
              proyecto, productora, nombre, puesto, codigoContable, esFijoDiscontinuo, salario45, horasRef, modoInverso45, objetivoSemanal45,
              fechaInicio, fechaFin, vacAcumulada, indemAcumulada,
              horasPorMes, vacDiasPorMes, festivosPorMes, festivosActivos, comidaDiasPorMes,
              plusHerramienta, plusCoche, plusVivienda, plusSeguroVida, plusComida,
              // Snapshot de resultados calculados (para Coste Empresa)
              _calculado: {
                desglose45: desglose45 || [],
                complementos45: complementos45 || [],
                baseRef, vacRef, indemRef, hxRef, vHora, vHoraEx,
                p40ref, sumaRef, salarioDia,
                totBase, totVac, totIndem, totHx, totPlus, totVd,
                totFinal, totalCompl,
                totalVac45, totalIndem45, totalFestDias45, totalFestImport45,
              },
            }}
            onCargarPerfil={(d) => {
              // v45: si hay proyecto activo, los campos Proyecto/Productora se mantienen del activo (no del perfil cargado)
              if (proyectoActivoCtx) {
                setProyecto(proyectoActivoCtx.nombre);
                setProductora(proyectoActivoCtx.productora);
              } else {
                if (d.proyecto !== undefined) setProyecto(d.proyecto);
                if (d.productora !== undefined) setProductora(d.productora);
              }
              if (d.nombre !== undefined) setNombre(d.nombre);
              if (d.puesto !== undefined) setPuesto(d.puesto);
              if (d.codigoContable !== undefined) setCodigoContable(d.codigoContable);
              if (d.esFijoDiscontinuo !== undefined) setEsFijoDiscontinuo(d.esFijoDiscontinuo);
              if (d.salario45 !== undefined) setSalario45(d.salario45);
              if (d.horasRef !== undefined) setHorasRef(d.horasRef);
              if (d.modoInverso45 !== undefined) setModoInverso45(d.modoInverso45);
              if (d.objetivoSemanal45 !== undefined) setObjetivoSemanal45(d.objetivoSemanal45);
              if (d.fechaInicio !== undefined) setFechaInicio(d.fechaInicio);
              if (d.fechaFin !== undefined) setFechaFin(d.fechaFin);
              if (d.vacAcumulada !== undefined) setVacAcumulada(d.vacAcumulada);
              if (d.indemAcumulada !== undefined) setIndemAcumulada(d.indemAcumulada);
              if (d.horasPorMes !== undefined) setHorasPorMes(d.horasPorMes);
              if (d.vacDiasPorMes !== undefined) setVacDiasPorMes(d.vacDiasPorMes);
              if (d.festivosPorMes !== undefined) setFestivosPorMes(d.festivosPorMes);
              if (d.festivosActivos !== undefined) setFestivosActivos(d.festivosActivos);
              if (d.comidaDiasPorMes !== undefined) setComidaDiasPorMes(d.comidaDiasPorMes);
              if (d.plusHerramienta !== undefined) setPlusHerramienta(d.plusHerramienta);
              if (d.plusCoche !== undefined) setPlusCoche(d.plusCoche);
              if (d.plusVivienda !== undefined) setPlusVivienda(d.plusVivienda);
              if (d.plusSeguroVida !== undefined) setPlusSeguroVida(d.plusSeguroVida);
              if (d.plusComida !== undefined) setPlusComida(d.plusComida);
            }}
          />

          <div style={P}>
            <div style={ST}>▸ Trabajador</div>
            <Field label="Proyecto" value={proyecto} onChange={setProyecto} type="text" hint="Nombre del proyecto / producción" readOnly={!!proyectoActivoCtx} lockHint="Del proyecto activo" />
            <Field label="Productora" value={productora} onChange={setProductora} type="text" hint="Empresa productora" readOnly={!!proyectoActivoCtx} lockHint="Del proyecto activo" />
            <Field label="Nombre" value={nombre} onChange={setNombre} type="text" />
            <PuestoSelector
              puesto={puesto}
              codigoContable={codigoContable}
              onPuesto={setPuesto}
              onCodigoContable={setCodigoContable}
            />
            {/* v47: Toggle Fijo Discontinuo — solo 40H */}
            {es40h && (
              <div
                onClick={() => setEsFijoDiscontinuo(v => !v)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 13px",
                  background: esFijoDiscontinuo ? "#faf1e0" : "#f0ede8",
                  borderRadius: 6,
                  border: `1px solid ${esFijoDiscontinuo ? "#c8963a" : "#e0ddd8"}`,
                  marginTop: 10, cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: esFijoDiscontinuo ? "#7a5a2a" : "#999", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                    Fijo discontinuo
                  </div>
                  <div style={{ fontSize: 9, color: "#777", marginTop: 2, fontFamily: "'Courier New', monospace" }}>
                    {esFijoDiscontinuo ? "Indemnización × 1,6433333" : "Indemnización estándar × 0,98632"}
                  </div>
                </div>
                <div style={{ position: "relative", width: 38, height: 20, flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 10, background: esFijoDiscontinuo ? "#c8a96e" : "#222", transition: "background 0.25s" }} />
                  <div style={{ position: "absolute", top: 3, left: esFijoDiscontinuo ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: esFijoDiscontinuo ? "#fff" : "#aaa", transition: "left 0.25s", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
                </div>
              </div>
            )}
          </div>

          <div style={P}>
            <div style={ST}>▸ Salario de Referencia</div>

            <div onClick={() => setModoInverso45(v=>!v)} style={{
              display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              padding:"8px 12px", borderRadius:5, marginBottom:10,
              background: modoInverso45?"rgba(184,134,74,0.08)":"transparent",
              border:`1px solid ${modoInverso45?"#c8963a":"#e0ddd8"}`,
            }}>
              <div style={{ position:"relative", width:34, height:18, flexShrink:0 }}>
                <div style={{ width:"100%", height:"100%", borderRadius:9, background:modoInverso45?"#b8864a":"#ddd", transition:"background 0.25s" }} />
                <div style={{ position:"absolute", top:2, left:modoInverso45?17:2, width:14, height:14, borderRadius:"50%", background:modoInverso45?"#fff":"#aaa", transition:"left 0.25s" }} />
              </div>
              <span style={{ fontSize:10, color:modoInverso45?"#7a5a2a":"#999", fontFamily:"'Courier New',monospace", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700 }}>Cálculo inverso</span>
            </div>

            {!modoInverso45 ? (
              <Field label={`Salario Pactado ${es40h ? "40h" : "45h"}`} value={salario45} onChange={setSalario45} prefix="€" hint={es40h ? "Bruto mensual: salario 40h + vacaciones + indemnización" : "Bruto mensual 45h: base 40h + vac + indem + horas extra"} />
            ) : (
              <div style={{ marginBottom:14 }}>
                <label style={LS}>Salario Pactado {es40h ? "40h" : "45h"}</label>
                <div style={{ padding:"10px 14px", background:"#f0ede8", borderRadius:4, border:"1px solid #c8963a", textAlign:"center", marginBottom:4 }}>
                  {p && p45Inverso
                    ? <span style={{ fontSize:20, fontWeight:700, color:"#b8864a", fontFamily:"'Courier New',monospace" }}>{fmtE(p45Inverso)}</span>
                    : <span style={{ fontSize:12, color:"#aaa" }}>— introduce fechas y horas —</span>}
                </div>
                <p style={{ margin:"0 0 8px", fontSize:9, color:"#888", fontFamily:"'Courier New',monospace" }}>Para {fmtE(objetivoSemanal45)}/semana</p>
                <Field label="Objetivo €/semana" value={objetivoSemanal45} onChange={setObjetivoSemanal45} prefix="€" />
              </div>
            )}

            {!es40h && <Field label="Horas de referencia / mes" value={horasRef} onChange={setHorasRef} hint="Nº horas extra del mes tipo (ej. 22)" />}

            <div style={{ padding:12, background:"#f0ede8", borderRadius:6, border:"1px solid #e0ddd8" }}>
              <div style={{ fontSize:9, color:"#666", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>Desglose mensual referencia</div>
              <div style={{ display:"grid", gridTemplateColumns: es40h ? "1fr 1fr 1fr" : "1fr 1fr", gap:6 }}>
                {[
                  { l:"Base 40h",     v:baseRef,  s:(es40h && esFijoDiscontinuo) ? "Salario÷1,14190" : "×0,89286" },
                  { l:"Vacaciones",   v:vacRef,   s:"Base÷11,478" },
                  { l:"Indemnización",v:indemRef, s:(es40h && esFijoDiscontinuo) ? "(Base/30)×1,6433" : "(Base/30)×0,986" },
                  ...(es40h ? [] : [{ l:`H.Extra (${horasRef}h)`,v:hxRef,s:`${horasRef}h×${fmt(vHoraEx)}€`, blue:true }]),
                ].map(it=>(
                  <div key={it.l} style={{ background:"#fff", borderRadius:4, padding:"7px", border:"1px solid #e8e4de", textAlign:"center" }}>
                    <div style={{ fontSize:8, color:"#666", textTransform:"uppercase", marginBottom:3 }}>{it.l}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:it.blue?"#3a6898":"#1a1a1a" }}>{fmt(it.v)} €</div>
                    <div style={{ fontSize:8, color:"#888", marginTop:2 }}>{it.s}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:"#fff", borderRadius:4, border:"1px solid #d8d4ce" }}>
                <span style={{ fontSize:9, color:"#666", textTransform:"uppercase", letterSpacing:"0.1em" }}>{es40h ? "TOTAL ≈ P40" : "TOTAL ≈ P45"}</span>
                <span style={{ fontSize:15, fontWeight:700, color:"#b8864a", fontFamily:"'Courier New',monospace" }}>{fmt(es40h ? (baseRef + vacRef + indemRef) : sumaRef)} €</span>
              </div>
            </div>
          </div>

          <div style={P}>
            <div style={ST}>▸ Período de Contratación</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, overflow:"hidden" }}>
              <Field label="Inicio" value={fechaInicio} onChange={setFechaInicio} type="date" hint="Primer día" />
              <Field label="Fin"    value={fechaFin}    onChange={setFechaFin}    type="date" hint="Último día" />
            </div>
            {p ? (
              <div style={{ marginTop:8, padding:12, background:"#f0ede8", borderRadius:6, border:"1px solid #e0ddd8" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                  {[
                    { l:"Días",     v:p.diasNormalizados, d:0 },
                    { l:"Meses",    v:p.mesesTotales,     d:4 },
                    { l:"Sem. L-V", v:p.semanasTotales,   d:1 },
                  ].map(it=>(
                    <div key={it.l} style={{ textAlign:"center", padding:"6px 4px", background:"#fff", borderRadius:4 }}>
                      <div style={{ fontSize:8, color:"#666", textTransform:"uppercase", marginBottom:3 }}>{it.l}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#b8864a" }}>{it.d===0?it.v:it.d===1?fmt(it.v,1):fmtM(it.v)}</div>
                    </div>
                  ))}
                </div>
                {p.desglose.map((d,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #e8e4de" }}>
                    <span style={{ fontSize:10, color:"#444", textTransform:"capitalize" }}>
                      {d.mes}{d.esCompleto?<span style={{fontSize:8,color:"#2a7a50",marginLeft:4}}>✓</span>:<span style={{fontSize:8,color:"#888",marginLeft:4}}>{d.desde}–{d.hasta}</span>}
                    </span>
                    <span style={{ fontSize:10, color:"#b8864a", fontWeight:600 }}>{fmtM(d.fraccion)}</span>
                  </div>
                ))}
              </div>
            ) : fechaInicio && fechaFin ? (
              <div style={{ marginTop:8, padding:10, background:"#fdf0f0", borderRadius:6, border:"1px solid #e8c0c0", fontSize:10, color:"#b02020" }}>⚠ Fecha fin debe ser posterior al inicio</div>
            ) : null}
          </div>

          {p && (
            <div style={P}>
              <div style={ST}>▸ Horas Extra, Vacaciones, Festivos</div>
              <InputsPorMes
                desglose={p.desglose}
                horasPorMes={horasPorMes}       setHorasPorMes={setHorasPorMes}
                vacDiasPorMes={vacDiasPorMes}   setVacDiasPorMes={setVacDiasPorMes}
                festivosPorMes={festivosPorMes} setFestivosPorMes={setFestivosPorMes}
              />
            </div>
          )}

          {/* Festivos del calendario laboral */}
          {p && (() => {
            const festsRango = festivosEnRango(fechaInicio, fechaFin);
            if (festsRango.length === 0) return (
              <div style={P}>
                <div style={ST}>▸ Festivos Calendario Laboral</div>
                <div style={{ fontSize:10, color:"#888", textAlign:"center", padding:"12px 0", fontFamily:"'Courier New',monospace" }}>
                  No hay festivos oficiales en este período
                </div>
              </div>
            );
            return (
              <div style={P}>
                <div style={ST}>▸ Festivos Calendario Laboral</div>
                <div style={{ fontSize:9, color:"#888", fontFamily:"'Courier New',monospace", marginBottom:10, lineHeight:1.4 }}>
                  Activa sólo los festivos que el trabajador efectivamente trabajó. Cada activación suma +1 al contador del mes correspondiente.
                </div>
                {festsRango.map(f => {
                  const activo = !!festivosActivos[f.fecha];
                  const idx = mesIndexParaFecha(f.fecha, p.desglose, fechaInicio);
                  const fechaObj = new Date(f.fecha + "T00:00:00");
                  const dow = ["dom","lun","mar","mié","jue","vie","sáb"][fechaObj.getDay()];
                  const dia = fechaObj.getDate();
                  const mes = fechaObj.toLocaleString("es-ES", { month: "short" }).replace(".","");
                  return (
                    <div key={f.fecha}
                      onClick={() => {
                        if (idx < 0) return;
                        const nuevo = { ...festivosActivos };
                        const nuevoEstado = !activo;
                        if (nuevoEstado) nuevo[f.fecha] = true; else delete nuevo[f.fecha];
                        setFestivosActivos(nuevo);
                        const arr = [...festivosPorMes];
                        arr[idx] = (arr[idx] || 0) + (nuevoEstado ? 1 : -1);
                        if (arr[idx] < 0) arr[idx] = 0;
                        setFestivosPorMes(arr);
                      }}
                      style={{
                        display:"flex", alignItems:"center", gap:8, padding:"7px 10px", marginBottom:4,
                        background: activo ? "rgba(106,58,154,0.08)" : "#f0ede8",
                        border: `1px solid ${activo ? "#8a5aaa" : "#e0ddd8"}`,
                        borderRadius:5, cursor:"pointer",
                      }}>
                      <div style={{
                        width:16, height:16, borderRadius:3, flexShrink:0,
                        border:`1.5px solid ${activo ? "#6a3a9a" : "#bbb"}`,
                        background: activo ? "#6a3a9a" : "#fff",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#fff", fontSize:11, fontWeight:700,
                      }}>
                        {activo ? "✓" : ""}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, fontFamily:"'Courier New',monospace", color: activo ? "#6a3a9a" : "#1a1a1a", fontWeight:600 }}>
                          {dow} {dia} {mes}
                          <span style={{ fontSize:8, marginLeft:6, padding:"1px 5px", borderRadius:2, background: f.tipo==="nacional"?"#e8e0d0":"#d8e8d8", color:"#555", letterSpacing:"0.05em", textTransform:"uppercase", fontWeight:700 }}>
                            {f.tipo==="nacional"?"Nac":"CCAA"}
                          </span>
                        </div>
                        <div style={{ fontSize:9, color:"#777", fontFamily:"'Courier New',monospace", marginTop:1 }}>
                          {f.nombre}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop:8, padding:"6px 10px", background:"#f0ede8", borderRadius:4, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Courier New',monospace" }}>Activos</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#6a3a9a", fontFamily:"'Courier New',monospace" }}>
                    {Object.keys(festivosActivos).filter(k=>festsRango.some(f=>f.fecha===k)).length} / {festsRango.length}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Comidas editables por mes */}
          {p && plusComida.importeDia > 0 && (
            <div style={P}>
              <div style={ST}>▸ Días de Comida por Mes</div>
              <div style={{ fontSize:9, color:"#888", fontFamily:"'Courier New',monospace", marginBottom:10 }}>
                Días calculados automáticamente (L-V). Edita si el trabajador no tiene comida algún día.
              </div>
              {p.desglose.map((d,i) => {
                const auto = Math.round(d.semanasLaborables*5);
                const val  = comidaDiasPorMes[i] !== null && comidaDiasPorMes[i] !== undefined ? comidaDiasPorMes[i] : auto;
                const isOverride = comidaDiasPorMes[i] !== null && comidaDiasPorMes[i] !== undefined && comidaDiasPorMes[i] !== auto;
                return (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 60px 60px", gap:8, marginBottom:5, alignItems:"center" }}>
                    <div style={{ fontSize:10, color:"#444", textTransform:"capitalize", fontFamily:"'Courier New',monospace" }}>
                      {d.mes}{!d.esCompleto&&<span style={{fontSize:8,color:"#aaa",marginLeft:4}}>{d.desde}–{d.hasta}</span>}
                    </div>
                    <div style={{ textAlign:"center", fontSize:10, color:"#888" }}>auto:{auto}d</div>
                    <input type="number" min="0" step="1"
                      value={val}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        const a = [...comidaDiasPorMes];
                        a[i] = isNaN(v) ? null : v;
                        setComidaDiasPorMes(a);
                      }}
                      style={{ background: isOverride?"#fff8f0":"#f0ede8", border:`1px solid ${isOverride?"#c8963a":"#d0ccc6"}`, borderRadius:4, color:"#1a1a1a", fontFamily:"'Courier New',monospace", fontSize:12, padding:"5px 6px", outline:"none", textAlign:"center", colorScheme:"light", minWidth:0 }}
                      onFocus={e=>e.target.style.borderColor="#b8864a"} onBlur={e=>e.target.style.borderColor=isOverride?"#c8963a":"#d0ccc6"} />
                  </div>
                );
              })}
              <div style={{ marginTop:8, padding:"6px 10px", background:"#f0ede8", borderRadius:4, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.1em" }}>Total días comida</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#b8864a" }}>{complementos45.reduce((s,c)=>s+c.diasComida,0)}d</span>
              </div>
              <button onClick={()=>setComidaDiasPorMes(p.desglose.map(()=>null))}
                style={{ marginTop:8, width:"100%", padding:"6px", fontSize:9, fontFamily:"'Courier New',monospace", letterSpacing:"0.1em", textTransform:"uppercase", background:"transparent", border:"1px solid #d0ccc6", borderRadius:4, cursor:"pointer", color:"#888" }}>
                Restablecer automático
              </button>
            </div>
          )}

          <div style={P}>
            <div style={ST}>▸ Modo de Pago</div>
            <Toggle label="Vacaciones al final"    value={vacAcumulada}   onChange={setVacAcumulada}   sublabel={vacAcumulada?"Total vacaciones en última nómina":"Prorrateadas cada mes"} />
            <Toggle label="Indemnización al final" value={indemAcumulada} onChange={setIndemAcumulada} sublabel={indemAcumulada?"Total indemnización en última nómina":"Prorrateada cada mes"} />
            <div style={{ fontSize:9, color:"#888", fontFamily:"'Courier New',monospace", marginTop:4, padding:"6px 10px", background:"#f0ede8", borderRadius:4, border:"1px solid #e0ddd8" }}>
              ℹ Las horas extra siempre se cobran el mes que se generan
            </div>
          </div>

          <div style={P}>
            <div style={ST}>▸ Complementos de Nómina</div>
            {[
              { label:"Plus Herramienta", plus:plusHerramienta, set:setPlusHerramienta },
              { label:"Plus Coche",       plus:plusCoche,       set:setPlusCoche },
              { label:"Plus Ayuda Vivienda", plus:plusVivienda, set:setPlusVivienda },
            ].map(({label,plus,set})=>(
              <div key={label} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <label style={{ ...LS, margin:0 }}>{label}</label>
                  <div style={{ display:"flex", gap:3 }}>
                    {["mes","sem"].map(m=>(
                      <button key={m} onClick={()=>set(p=>({...p,modo:m}))}
                        style={{ padding:"2px 7px", fontSize:9, fontFamily:"'Courier New',monospace", letterSpacing:"0.08em", textTransform:"uppercase", border:"1px solid #d0ccc6", borderRadius:3, cursor:"pointer", fontWeight:700, background:plus.modo===m?"#1a1a1a":"#fff", color:plus.modo===m?"#fff":"#888" }}>
                        {m==="mes"?"€/mes":"€/sem"}
                      </button>
                    ))}
                  </div>
                </div>
                <Field value={plus.importe} onChange={v=>set(p=>({...p,importe:v}))} prefix="€" />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={LS}>Plus Seguro de Vida (€/mes)</label>
              <Field value={plusSeguroVida.importe} onChange={v=>setPlusSeguroVida({importe:v})} prefix="€" hint="Sólo prorrateo mensual" />
            </div>
            <div>
              <label style={LS}>Plus Comida (€/día L-V)</label>
              <Field value={plusComida.importeDia} onChange={v=>setPlusComida({importeDia:v})} prefix="€" hint="Calculado automáticamente por días laborables de cada mes" />
            </div>
          </div>

          {/* Bloque legal */}
          <div style={{ ...P, background:"#fafaf7", border:"1px solid #e8e4de" }}>
            <div style={{ ...ST, color:"#888", marginBottom:10 }}>▸ Aviso Legal</div>
            <div style={{ fontSize:10, fontWeight:700, color:"#1a1a1a", fontFamily:"'Courier New',monospace", marginBottom:8, letterSpacing:"0.05em" }}>
              BD PROD TOOLS
            </div>
            <div style={{ fontSize:9, color:"#666", fontFamily:"'Courier New',monospace", lineHeight:1.5, marginBottom:8 }}>
              {DISCLAIMER_ES}
            </div>
            <div style={{ fontSize:8, color:"#888", fontFamily:"'Courier New',monospace", lineHeight:1.5, fontStyle:"italic", marginBottom:8 }}>
              {DISCLAIMER_EN}
            </div>
            <div style={{ fontSize:8, color:"#888", fontFamily:"'Courier New',monospace", lineHeight:1.5, fontStyle:"italic" }}>
              G &amp; G Enterprises LLC
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA */}
        <div style={{ minWidth: 0 }}>
          {p && desglose45.length > 0 ? (
            <>
              <div style={P}>
                <div style={ST}>▸ Desglose Mensual Referencia <BadgeBrutos /></div>
                <div style={{ display:"grid", gridTemplateColumns: es40h ? "repeat(3,1fr)" : "repeat(4,1fr)", gap:10 }}>
                  {[
                    { l:"Base 40h",     v:baseRef,  s:(es40h && esFijoDiscontinuo) ? "Salario ÷ 1,14190" : "× 0,89286" },
                    { l:"Vacaciones",   v:vacRef,   s:"Base ÷ 11,478" },
                    { l:"Indemnización",v:indemRef, s:(es40h && esFijoDiscontinuo) ? "(Base/30) × 1,6433" : "(Base/30) × 0,986" },
                    ...(es40h ? [] : [{ l:`H.Extra (${horasRef}h)`, v:hxRef, s:`${horasRef}h × ${fmt(vHoraEx)}€`, blue:true }]),
                  ].map(it=>(
                    <div key={it.l} style={{ background:"#f0ede8", borderRadius:6, padding:"12px 10px", border:"1px solid #e0ddd8", textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"#666", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{it.l}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:it.blue?"#3a6898":"#1a1a1a" }}>{fmt(it.v)} €</div>
                      <div style={{ fontSize:8, color:"#888", marginTop:4 }}>{it.s}</div>
                    </div>
                  ))}
                </div>
                {es40h ? (
                  <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ padding:"10px 14px", background:"rgba(184,134,74,0.08)", borderRadius:6, border:"1px solid #e0ddd8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:9.5, color:"#7a5a2a", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace" }}>Total Mes 40h</span>
                      <span style={{ fontSize:16, fontWeight:700, color:"#b8864a", fontFamily:"'Courier New',monospace" }}>{fmt(baseRef + vacRef + indemRef)} €</span>
                    </div>
                    <div style={{ padding:"10px 14px", background:"rgba(58,104,152,0.08)", borderRadius:6, border:"1px solid #b8cce0", display:"flex", flexDirection:"column" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:9.5, color:"#2a5a8a", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace" }}>Salario en Contrato</span>
                        <span style={{ fontSize:16, fontWeight:700, color:"#3a6898", fontFamily:"'Courier New',monospace" }}>{fmt(vacAcumulada ? baseRef : (baseRef + vacRef))} €</span>
                      </div>
                      {vacAcumulada && (
                        <div style={{ fontSize:8.5, color:"#5a7a9a", marginTop:2, textAlign:"right", letterSpacing:"0.05em", fontStyle:"italic", fontFamily:"'Courier New',monospace" }}>Base 40h · vacaciones al final</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ padding:"10px 14px", background:"rgba(184,134,74,0.08)", borderRadius:6, border:"1px solid #e0ddd8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:9.5, color:"#7a5a2a", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace" }}>Total Mes 45h Todo Incluido</span>
                      <span style={{ fontSize:16, fontWeight:700, color:"#b8864a", fontFamily:"'Courier New',monospace" }}>{fmt(sumaRef)} €</span>
                    </div>
                    <div style={{ padding:"10px 14px", background:"rgba(58,104,152,0.08)", borderRadius:6, border:"1px solid #b8cce0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:9.5, color:"#2a5a8a", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Courier New',monospace" }}>Salario en Contrato</span>
                      <span style={{ fontSize:16, fontWeight:700, color:"#3a6898", fontFamily:"'Courier New',monospace" }}>{fmt(baseRef + vacRef)} €</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Nota informativa. En 45H siempre se muestra. En 40H solo si vacaciones NO van al final */}
              {(!es40h || !vacAcumulada) && (
                <div style={{ background:"#fafaf7", padding:"10px 14px", borderRadius:6, border:"1px solid #e0ddd8", marginBottom:20, fontSize:10, color:"#666", fontFamily:"'Courier New',monospace", lineHeight:1.5, fontStyle:"italic" }}>
                  <strong style={{ color:"#444", fontStyle:"normal" }}>Nota:</strong> {es40h
                    ? "Salario en contrato es la suma del salario base + las vacaciones."
                    : "El salario que figura en contrato es la suma del salario base 40h más las vacaciones."}
                </div>
              )}

              <div style={P}>
                <div style={ST}>▸ Valores de Referencia <BadgeBrutos /></div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
                  {[
                    { l:"Salario / Día",    v: salarioDia,          s:"Base ÷ 30" },
                    { l:"Salario / Semana", v: salarioDia * 7,      s:"Día × 7" },
                    { l:"Valor Hora",       v: vHora,               s:"Semana ÷ 40h" },
                    { l:"Hora Extra ×1,5",  v: vHoraEx,             s:"Hora × 1,5",   blue:true },
                    { l:"Festivo ×1,75",    v: salarioDia * 1.75,   s:"Día × 1,75",   purple:true },
                  ].map(it=>(
                    <div key={it.l} style={{ background:"#f0ede8", borderRadius:6, padding:"12px 10px", border:`1px solid ${it.purple?"#d0b8e8":it.blue?"#b8cce0":"#e0ddd8"}`, textAlign:"center" }}>
                      <div style={{ fontSize:8, color:"#666", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{it.l}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:it.purple?"#6a3a9a":it.blue?"#3a6898":"#1a1a1a" }}>{fmt(it.v)} €</div>
                      <div style={{ fontSize:8, color:"#888", marginTop:4 }}>{it.s}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={P}>
                <div style={{ ...ST, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>▸ Nómina {es40h ? "40h" : "45h"} por Mes <BadgeBrutos /></span>
                  <span style={{ display:"flex", gap:5 }}>
                    {vacAcumulada   && <span style={{ fontSize:8, background:"rgba(184,134,74,0.12)", color:"#8a5e20", borderRadius:3, padding:"2px 6px" }}>VAC AL FINAL</span>}
                    {indemAcumulada && <span style={{ fontSize:8, background:"rgba(184,134,74,0.12)", color:"#8a5e20", borderRadius:3, padding:"2px 6px" }}>INDEM AL FINAL</span>}
                  </span>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"left",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#555"}}>Mes</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#555"}}>Fracc.</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#555"}}>Base 40h €</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#555"}}>Vac. €</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#555"}}>Indem. €</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#3a6898"}}>H.Ex h</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#3a6898"}}>H.Ex €</th>
                        {!es40h && <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#b07030"}}>Plus Act. €</th>}
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#1a1a1a"}}>TOTAL MES €</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#5a8a5a"}}>Compl. €</th>
                        <th style={{padding:"6px 6px",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,textAlign:"right",fontFamily:"'Courier New',monospace",borderBottom:"1px solid #e0ddd8",color:"#b8864a"}}>TOTAL MES + Compl. €</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desglose45.map((d,i)=>(
                        <tr key={i} style={{ background:i%2===0?"transparent":"rgba(0,0,0,0.015)" }}>
                          <td style={{padding:"6px 6px",fontSize:10.5,fontFamily:"'Courier New',monospace",color:"#1a1a1a",borderBottom:"1px solid #eae7e2",lineHeight:1.25,whiteSpace:"nowrap"}}>
                            {(() => {
                              const partes = d.mes.split(" de ");
                              const mesNom = partes[0] || d.mes;
                              const anio = partes[1] || "";
                              return (
                                <>
                                  <span style={{textTransform:"capitalize",fontWeight:600}}>{mesNom}</span>
                                  <span style={{color:"#888",fontSize:9,marginLeft:5}}>{anio}</span>
                                  {!d.esCompleto&&<span style={{fontSize:8,color:"#b8864a",marginLeft:5}}>({d.desde}–{d.hasta})</span>}
                                </>
                              );
                            })()}
                          </td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#888",borderBottom:"1px solid #eae7e2"}}>{fmtM(d.fraccion)}</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#1a1a1a",borderBottom:"1px solid #eae7e2"}}>{fmt(d.base40)}</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:d.vac40===0?"#ccc":"#1a1a1a",borderBottom:"1px solid #eae7e2"}}>{d.vac40===0?"—":fmt(d.vac40)}</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:d.indem40===0?"#ccc":"#1a1a1a",borderBottom:"1px solid #eae7e2"}}>{d.indem40===0?"—":fmt(d.indem40)}</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#3a6898",borderBottom:"1px solid #eae7e2"}}>{d.hMes}h</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#3a6898",borderBottom:"1px solid #eae7e2"}}>{fmt(d.cobroHx)}</td>
                          {!es40h && <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:d.plusAct>0?"#b07030":"#ccc",fontWeight:d.plusAct>0?600:400,borderBottom:"1px solid #eae7e2"}}>{d.plusAct>0?fmt(d.plusAct):"—"}</td>}
                          <td style={{padding:"6px 6px",fontSize:13,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#1a1a1a",fontWeight:700,borderBottom:"1px solid #eae7e2"}}>{fmt(es40h ? (d.totalMes - (d.plusAct || 0)) : d.totalMes)}</td>
                          <td style={{padding:"6px 6px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:(complementos45[i]?.total || 0) > 0 ? "#5a8a5a" : "#ccc",fontWeight:(complementos45[i]?.total || 0) > 0 ? 600 : 400,borderBottom:"1px solid #eae7e2"}}>{(complementos45[i]?.total || 0) > 0 ? fmt(complementos45[i].total) : "—"}</td>
                          <td style={{padding:"6px 6px",fontSize:13,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#b8864a",fontWeight:700,borderBottom:"1px solid #eae7e2"}}>{fmt((es40h ? (d.totalMes - (d.plusAct || 0)) : d.totalMes) + (complementos45[i]?.total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"rgba(184,134,74,0.06)" }}>
                        <td colSpan={2} style={{padding:"8px",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,fontFamily:"'Courier New',monospace",color:"#b8864a",borderTop:"1px solid #d8d4ce"}}>TOTAL</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#666",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt(totBase)}</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#666",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt(totVac)}</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#666",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt(totIndem)}</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#3a6898",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{horasPorMes.reduce((s,v,i)=>{if (v === undefined || v === null || v === "") return s + Math.round((p.desglose[i]?.semanasLaborables||0)*5);return s + (v || 0);},0)}h</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#3a6898",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt(totHx)}</td>
                        {!es40h && <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:totPlus>0?"#b07030":"#ccc",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{totPlus>0?fmt(totPlus):"—"}</td>}
                        <td style={{padding:"8px",fontSize:13,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#1a1a1a",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt(es40h ? (totFinal - (totPlus || 0)) : totFinal)}</td>
                        <td style={{padding:"8px",fontSize:11,textAlign:"right",fontFamily:"'Courier New',monospace",color:totalCompl > 0 ? "#5a8a5a" : "#ccc",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{totalCompl > 0 ? fmt(totalCompl) : "—"}</td>
                        <td style={{padding:"8px",fontSize:13,textAlign:"right",fontFamily:"'Courier New',monospace",color:"#b8864a",fontWeight:700,borderTop:"1px solid #d8d4ce"}}>{fmt((es40h ? (totFinal - (totPlus || 0)) : totFinal) + totalCompl)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Tabla detallada de complementos por mes */}
              {totalCompl > 0 && (
                <div style={P}>
                  <div style={ST}>▸ Complementos de Nómina por Mes</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Mes","Herramienta €","Coche €","Vivienda €","Seguro Vida €","Días comida","Comida €","TOTAL PLUS €"].map((h, hi) => (
                            <th key={hi} style={{ padding: "7px 10px", fontSize: 9, letterSpacing: "0.12em",
                              textTransform: "uppercase", color: "#555", fontWeight: 700,
                              textAlign: hi === 0 ? "left" : "right",
                              fontFamily: "'Courier New', monospace", borderBottom: "1px solid #e0ddd8" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {complementos45.map((c, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}>
                            <td style={{ padding: "8px 10px", fontSize: 11, fontFamily: "'Courier New', monospace", color: "#1a1a1a", textTransform: "capitalize", borderBottom: "1px solid #eae7e2" }}>
                              {p.desglose[i].mes}
                              {!p.desglose[i].esCompleto && <span style={{ fontSize: 9, color: "#888", marginLeft: 6 }}>{p.desglose[i].desde}–{p.desglose[i].hasta}</span>}
                            </td>
                            {[
                              plusHerramienta.importe ? fmt(c.herramienta) : "—",
                              plusCoche.importe       ? fmt(c.coche)       : "—",
                              plusVivienda.importe    ? fmt(c.vivienda)    : "—",
                              plusSeguroVida.importe  ? fmt(c.seguroVida)  : "—",
                              plusComida.importeDia   ? `${c.diasComida}d` : "—",
                              plusComida.importeDia   ? fmt(c.comida)      : "—",
                            ].map((v, vi) => (
                              <td key={vi} style={{ padding: "8px 10px", fontSize: 11, textAlign: "right",
                                fontFamily: "'Courier New', monospace", color: v === "—" ? "#ccc" : "#1a1a1a",
                                borderBottom: "1px solid #eae7e2" }}>{v}</td>
                            ))}
                            <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right",
                              fontFamily: "'Courier New', monospace", color: "#b8864a", fontWeight: 700,
                              borderBottom: "1px solid #eae7e2" }}>{fmt(c.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background:"rgba(184,134,74,0.06)" }}>
                          <td style={{ padding:"8px 10px", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700, fontFamily:"'Courier New',monospace", color:"#b8864a", borderTop:"1px solid #d8d4ce" }}>TOTAL</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusHerramienta.importe ? fmt(complementos45.reduce((s,c)=>s+c.herramienta,0)) : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusCoche.importe ? fmt(complementos45.reduce((s,c)=>s+c.coche,0)) : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusVivienda.importe ? fmt(complementos45.reduce((s,c)=>s+c.vivienda,0)) : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusSeguroVida.importe ? fmt(complementos45.reduce((s,c)=>s+c.seguroVida,0)) : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusComida.importeDia ? `${complementos45.reduce((s,c)=>s+c.diasComida,0)}d` : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:11, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#666", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{plusComida.importeDia ? fmt(complementos45.reduce((s,c)=>s+c.comida,0)) : "—"}</td>
                          <td style={{ padding:"8px 10px", fontSize:13, textAlign:"right", fontFamily:"'Courier New',monospace", color:"#b8864a", fontWeight:700, borderTop:"1px solid #d8d4ce" }}>{fmt(totalCompl)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(184,134,74,0.06)",
                    borderRadius: 6, border: "1px solid #e0ddd8", display: "flex",
                    justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase",
                        fontFamily: "'Courier New', monospace", marginBottom: 4 }}>Total a percibir + complementos</div>
                      <div style={{ fontSize: 10, color: "#999", fontFamily: "'Courier New', monospace" }}>
                        {fmtE(totFinal)} salario {totalFestDias45 > 0 && `+ ${fmtE(totalFestImport45)} festivos `}+ {fmtE(totalCompl)} complementos
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#b8864a", fontFamily: "'Courier New', monospace" }}>
                      {fmtE(totFinal + totalFestImport45 + totalCompl)}
                    </div>
                  </div>
                </div>
              )}

              <div style={P}>
                <div style={ST}>▸ Resumen del Período <BadgeBrutos /></div>
                <Row label="Base 40h equivalente"  value={fmtE(totBase)} />
                <Row label="  · Vacaciones"         value={fmtE(totalVac45)}   muted />
                <Row label="  · Indemnización"      value={fmtE(totalIndem45)} muted />
                <Div />
                <Row label={`+ Horas extra (${horasPorMes.reduce((s,v)=>s+(v||0),0)}h)`} value={`+ ${fmtE(totHx)}`} />
                {totPlus > 0 && !es40h && <Row label="+ Plus de Actividad" value={`+ ${fmtE(totPlus)}`} />}
                {totVd  > 0 && <Row label={`− Vac. disfrutadas (${totalVdDias}d)`} value={`− ${fmtE(totVd)}`} />}
                <Div />
                <Row label={`TOTAL A PERCIBIR (${es40h ? "40h" : "45h"})`} value={fmtE(es40h ? (totFinal - (totPlus || 0)) : totFinal)} highlight />
                <Row label="Promedio mensual" value={fmtE((es40h ? (totFinal - (totPlus || 0)) : totFinal)/p.mesesTotales)} sub={`sobre ${fmtM(p.mesesTotales)} meses`} green />
                <Row label="Promedio semanal" value={fmtE((es40h ? (totFinal - (totPlus || 0)) : totFinal)/p.semanasTotales)} sub={`sobre ${p.semanasTotales} sem. L-V`} />
                {(totalCompl > 0 || totalFestDias45 > 0) && (
                  <>
                    <Div />
                    <div style={{ padding:"10px 12px", background:"#f8f5ff", borderRadius:6, border:"1px solid #d8c8e8" }}>
                      <div style={{ fontSize:9, color:"#6a3a9a", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Extras del período</div>
                      {totalFestDias45 > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:11, color:"#6a3a9a", fontFamily:"'Courier New',monospace" }}>{totalFestDias45} festivo{totalFestDias45>1?"s":""}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#6a3a9a", fontFamily:"'Courier New',monospace" }}>+ {fmtE(totalFestImport45)}</span>
                        </div>
                      )}
                      {totalCompl > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:11, color:"#5a8a5a", fontFamily:"'Courier New',monospace" }}>Complementos</span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#5a8a5a", fontFamily:"'Courier New',monospace" }}>+ {fmtE(totalCompl)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {/* Aviso orientativo */}
                <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid #e0ddd8", fontSize:10, color:"#666", fontFamily:"'Courier New',monospace", lineHeight:1.5, fontStyle:"italic", textAlign:"center" }}>
                  Cálculo orientativo del salario mensual bruto, que puede diferir ligeramente de la nómina real generada en cada periodo.
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...P, textAlign:"center", padding:"80px 24px" }}>
              <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>📋</div>
              <div style={{ fontSize:10, color:"#bbb", letterSpacing:"0.15em", textTransform:"uppercase" }}>Introduce el salario y las fechas<br/>para calcular el desglose</div>
            </div>
          )}
        </div>
      </div>

      {/* Botones de exportación al pie */}
      <div className="no-print" style={{ maxWidth: 1400, margin: "20px auto 0", display: "flex", justifyContent: "center", gap: 10 }}>
        <button
          onClick={exportarCSV45}
          disabled={!p || desglose45.length === 0}
          style={{
            padding: "10px 24px", fontSize: 11, fontFamily: "'Courier New', monospace",
            letterSpacing: "0.15em", textTransform: "uppercase", borderRadius: 4,
            cursor: (p && desglose45.length) ? "pointer" : "not-allowed", fontWeight: 700,
            border: "1px solid #b8864a",
            background: (p && desglose45.length) ? "#b8864a" : "transparent",
            color: (p && desglose45.length) ? "#fff" : "#666",
            opacity: (p && desglose45.length) ? 1 : 0.5,
            transition: "all 0.15s",
          }}
          title="Descargar nómina como CSV (Excel)"
        >⬇ Exportar CSV</button>
        <button
          onClick={exportarPDF45}
          disabled={!p || desglose45.length === 0}
          style={{
            padding: "10px 24px", fontSize: 11, fontFamily: "'Courier New', monospace",
            letterSpacing: "0.15em", textTransform: "uppercase", borderRadius: 4,
            cursor: (p && desglose45.length) ? "pointer" : "not-allowed", fontWeight: 700,
            border: "1px solid #b8864a",
            background: (p && desglose45.length) ? "#b8864a" : "transparent",
            color: (p && desglose45.length) ? "#fff" : "#666",
            opacity: (p && desglose45.length) ? 1 : 0.5,
            transition: "all 0.15s",
          }}
          title="Abrir vista de PDF (Guardar HTML / Imprimir / Cerrar)"
        >🖨 Abrir PDF</button>
      </div>

      {/* Banner de error/confirmación de exportación */}
      {exportError && (
        <div className="no-print" style={{
          maxWidth: 1400, margin: "12px auto 0", padding: "10px 16px",
          background: exportError.tipo === "ok" ? "#e8f5e8" : "#fdf0f0",
          border: `1px solid ${exportError.tipo === "ok" ? "#c0e0c0" : "#e8c0c0"}`,
          borderRadius: 5, color: exportError.tipo === "ok" ? "#2a7a50" : "#b02020",
          fontFamily: "'Courier New', monospace", fontSize: 11, textAlign: "center",
        }}>
          {typeof exportError === "string" ? exportError : exportError.mensaje}
        </div>
      )}

      <div style={{ maxWidth:1400, margin:"12px auto 0", textAlign:"center", fontSize:8, color:"#aaa", letterSpacing:"0.1em", textTransform:"uppercase" }}>
        P40 = P45 ÷ (1 + 0,89286/30×7/40×1,5 × h) · Base = P40 × 0,89286 · Vac = Base ÷ 11,478452 · Plus Actividad = máx(0, P45×fracc − cobro)
      </div>
      <div style={{ maxWidth: 1400, margin: "8px auto 0", textAlign: "center", fontSize: 7, color: "#bbb", letterSpacing: "0.05em" }}>
        {DISCLAIMER_PDF}
      </div>

      {/* ═══ MODAL CSV ═══ */}
      {modalCSV && (
        <ModalCSV
          contenido={modalCSV.contenido}
          filename={modalCSV.filename}
          onClose={() => setModalCSV(null)}
        />
      )}

      {/* ═══ MODAL PDF (vista print fullscreen) ═══ */}
      {modalPDF && (
        <ModalPDF
          onClose={() => setModalPDF(false)}
          filename={(() => {
            const partes = [proyecto, productora, nombre].filter(Boolean).map(s => s.replace(/[^a-zA-Z0-9]/g, "_"));
            return (partes.length ? partes.join("_") : "calculadora") + "_45h.pdf";
          })()}
          contenidoPrint={
            <DocumentoImprimible
              logoEmpresa={logoEmpresa}
              nombre={nombre} puesto={puesto} proyecto={proyecto} productora={productora}
              fechaInicio={fechaInicio} fechaFin={fechaFin}
              salario45efectivo={salario45efectivo} horasRef={horasRef}
              p40ref={p40ref} sumaRef={sumaRef}
              baseRef={baseRef} vacRef={vacRef} indemRef={indemRef} hxRef={hxRef} vHoraEx={vHoraEx}
              vHora={vHora} salarioDia={salarioDia}
              p={p} desglose45={desglose45} complementos45={complementos45}
              vacAcumulada={vacAcumulada} indemAcumulada={indemAcumulada}
              horasPorMes={horasPorMes}
              importeVdMes={importeVdMes} importeFestMes45={importeFestMes45}
              totBase={totBase} totVac={totVac} totIndem={totIndem}
              totHx={totHx} totPlus={totPlus} totVd={totVd}
              totalVdDias={totalVdDias} totalCompl={totalCompl}
              totFinal={totFinal}
              totalVac45={totalVac45} totalIndem45={totalIndem45}
              totalFestDias45={totalFestDias45} totalFestImport45={totalFestImport45}
              plusHerramienta={plusHerramienta} plusCoche={plusCoche}
              plusVivienda={plusVivienda} plusSeguroVida={plusSeguroVida}
              plusComida={plusComida}
              es40h={es40h}
              codigoContable={codigoContable}
              esFijoDiscontinuo={esFijoDiscontinuo}
            />
          }
        />
      )}

      {/* Div oculto con el documento para exportación HTML */}
      {p && desglose45.length > 0 && (
        <div id="doc-imprimible-oculto" style={{ position: "absolute", left: "-99999px", top: 0, width: "210mm", visibility: "hidden", pointerEvents: "none" }} aria-hidden="true">
          <DocumentoImprimible
            logoEmpresa={logoEmpresa}
            nombre={nombre} puesto={puesto} proyecto={proyecto} productora={productora}
            fechaInicio={fechaInicio} fechaFin={fechaFin}
            salario45efectivo={salario45efectivo} horasRef={horasRef}
            p40ref={p40ref} sumaRef={sumaRef}
            baseRef={baseRef} vacRef={vacRef} indemRef={indemRef} hxRef={hxRef} vHoraEx={vHoraEx}
            vHora={vHora} salarioDia={salarioDia}
            p={p} desglose45={desglose45} complementos45={complementos45}
            vacAcumulada={vacAcumulada} indemAcumulada={indemAcumulada}
            horasPorMes={horasPorMes}
            importeVdMes={importeVdMes} importeFestMes45={importeFestMes45}
            totBase={totBase} totVac={totVac} totIndem={totIndem}
            totHx={totHx} totPlus={totPlus} totVd={totVd}
            totalVdDias={totalVdDias} totalCompl={totalCompl}
            totFinal={totFinal}
            totalVac45={totalVac45} totalIndem45={totalIndem45}
            totalFestDias45={totalFestDias45} totalFestImport45={totalFestImport45}
            plusHerramienta={plusHerramienta} plusCoche={plusCoche}
            plusVivienda={plusVivienda} plusSeguroVida={plusSeguroVida}
            plusComida={plusComida}
            es40h={es40h}
            codigoContable={codigoContable}
            esFijoDiscontinuo={esFijoDiscontinuo}
          />
        </div>
      )}

    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════
// SUPABASE: AUTH + GESTIÓN DE USUARIOS
// ═══════════════════════════════════════════════════════════════════════

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const AUTH_KEY = "calc_user_v2";

// Duración máxima de sesión sin actividad (en milisegundos).
// El contador se resetea cada vez que el usuario interactúa con la app.
// Cambia este valor si quieres más/menos tiempo:
//   30 min = 30 * 60 * 1000
//   1 hora = 60 * 60 * 1000
//   1 día  = 24 * 60 * 60 * 1000
const SESION_DURACION_MS = 30 * 60 * 1000;

// --- Cliente REST ligero a Supabase (sin librería externa) ---
async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase error ${res.status}: ${txt}`);
  }
  // DELETE/PATCH a veces devuelven cuerpo vacío
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Login: busca por nombre+pin
async function loginUsuario(nombre, pin) {
  const params = new URLSearchParams({
    nombre: `eq.${nombre}`,
    pin: `eq.${pin}`,
    activo: `eq.true`,
    select: "id,nombre,es_admin",
  });
  const data = await supabaseFetch(`usuarios?${params}`);
  return Array.isArray(data) && data.length === 1 ? data[0] : null;
}

// Lista de nombres (para dropdown del login - solo usuarios activos)
async function listarNombres() {
  const data = await supabaseFetch(`usuarios?activo=eq.true&select=nombre&order=nombre.asc`);
  return data.map(u => u.nombre);
}

// Lista completa (admin)
async function listarUsuariosAdmin(adminPin) {
  const data = await supabaseFetch(`usuarios?select=*&order=nombre.asc`, {
    headers: { "x-admin-pin": adminPin },
  });
  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// PROYECTOS (v43)
// ═══════════════════════════════════════════════════════════════════════

// Listar proyectos activos (para admin: todos; para usuario normal: solo los asignados)
async function listarProyectos({ adminPin, usuarioId, esAdmin }) {
  if (esAdmin && adminPin) {
    // Admin: ve todos los proyectos
    const data = await supabaseFetch(`proyectos?select=*&order=nombre.asc`, {
      headers: { "x-admin-pin": adminPin },
    });
    return data || [];
  }
  // Usuario normal: solo los proyectos asignados y activos
  const rel = await supabaseFetch(`usuario_proyectos?usuario_id=eq.${usuarioId}&select=proyecto_id`);
  if (!Array.isArray(rel) || rel.length === 0) return [];
  const ids = rel.map(r => r.proyecto_id).join(",");
  const data = await supabaseFetch(`proyectos?id=in.(${ids})&activo=eq.true&select=*&order=nombre.asc`);
  return data || [];
}

async function crearProyecto(adminPin, nombre, productora) {
  return supabaseFetch(`proyectos`, {
    method: "POST",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify({ nombre, productora, activo: true }),
  });
}

async function actualizarProyecto(adminPin, id, cambios) {
  return supabaseFetch(`proyectos?id=eq.${id}`, {
    method: "PATCH",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify(cambios),
  });
}

async function borrarProyecto(adminPin, id) {
  return supabaseFetch(`proyectos?id=eq.${id}`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
}

// Relaciones usuario_proyectos
async function listarAsignaciones(adminPin) {
  const data = await supabaseFetch(`usuario_proyectos?select=*`, {
    headers: { "x-admin-pin": adminPin },
  });
  return data || [];
}

async function asignarUsuarioProyecto(adminPin, usuarioId, proyectoId) {
  return supabaseFetch(`usuario_proyectos`, {
    method: "POST",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify({ usuario_id: usuarioId, proyecto_id: proyectoId }),
  });
}

async function desasignarUsuarioProyecto(adminPin, usuarioId, proyectoId) {
  return supabaseFetch(`usuario_proyectos?usuario_id=eq.${usuarioId}&proyecto_id=eq.${proyectoId}`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PERFILES en Supabase (v46)
// ═══════════════════════════════════════════════════════════════════════

// Listar perfiles con filtro por proyecto y tab_id
// - Si proyectoId es null y verTodos=false → devuelve []
// - Si verTodos=true (admin) → todos los perfiles
async function listarPerfilesSupabase({ tabId, proyectoId, verTodos, adminPin }) {
  let path = `perfiles?select=*&order=created_at.desc`;
  if (tabId) path += `&tab_id=eq.${tabId}`;
  if (!verTodos) {
    if (!proyectoId) return [];
    path += `&proyecto_id=eq.${proyectoId}`;
  }
  const headers = verTodos && adminPin ? { "x-admin-pin": adminPin } : {};
  try {
    const data = await supabaseFetch(path, { headers });
    return data || [];
  } catch (e) {
    console.warn("Error cargando perfiles Supabase:", e.message);
    return null; // null = error de red (para que caller sepa que debe usar fallback)
  }
}

async function crearPerfilSupabase({ proyectoId, tabId, nombre, autor, datos }) {
  return supabaseFetch(`perfiles`, {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify({
      proyecto_id: proyectoId,
      tab_id: tabId,
      nombre,
      autor,
      datos,
    }),
  });
}

async function borrarPerfilSupabase(perfilId, adminPin) {
  const headers = adminPin ? { "x-admin-pin": adminPin } : {};
  return supabaseFetch(`perfiles?id=eq.${perfilId}`, {
    method: "DELETE",
    headers,
  });
}


async function crearUsuario(adminPin, nombre, pin, esAdmin) {
  return supabaseFetch(`usuarios`, {
    method: "POST",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify({ nombre, pin, es_admin: esAdmin }),
  });
}

async function actualizarUsuario(adminPin, id, cambios) {
  return supabaseFetch(`usuarios?id=eq.${id}`, {
    method: "PATCH",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify(cambios),
  });
}

async function borrarUsuario(adminPin, id) {
  return supabaseFetch(`usuarios?id=eq.${id}`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
}

// --- LOGS DE ACTIVIDAD ---
// Registrar evento (login, export_csv, export_pdf). No bloqueante: si falla, sigue.
async function registrarLog(usuarioNombre, tipo, detalle = "") {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 200);
    await supabaseFetch(`logs_actividad`, {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({
        usuario_nombre: usuarioNombre,
        tipo,
        detalle: detalle || null,
        user_agent: ua || null,
      }),
    });
  } catch (e) {
    // Silencioso: no queremos romper la app si los logs fallan
    console.warn("registrarLog falló:", e.message);
  }
}

// --- PUESTOS COAC (catálogo en Supabase) ---
// Listar todos los puestos (público, no requiere admin)
async function listarPuestosCoac() {
  const data = await supabaseFetch(`puestos_coac?select=*&order=orden.asc,nombre.asc`);
  return data || [];
}

// Crear puesto manualmente
async function crearPuestoCoac(adminPin, { codigo, nombre, categoria, orden = 0 }) {
  return supabaseFetch(`puestos_coac`, {
    method: "POST",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify({ codigo, nombre, categoria, orden }),
  });
}

// Actualizar puesto
async function actualizarPuestoCoac(adminPin, id, cambios) {
  return supabaseFetch(`puestos_coac?id=eq.${id}`, {
    method: "PATCH",
    headers: { "x-admin-pin": adminPin, "Prefer": "return=representation" },
    body: JSON.stringify(cambios),
  });
}

// Borrar puesto
async function borrarPuestoCoac(adminPin, id) {
  return supabaseFetch(`puestos_coac?id=eq.${id}`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
}

// Reemplazar TODOS los puestos: borra todos y carga los nuevos (usado por importador Excel)
async function reemplazarTodosPuestos(adminPin, nuevosPuestos) {
  // 1. Borrar todos
  // Usamos id=gte.0 que matchea todos
  await supabaseFetch(`puestos_coac?id=gte.0`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
  // 2. Insertar nuevos en lotes (Supabase tiene límite de payload, 200 a la vez es seguro)
  const BATCH = 200;
  for (let i = 0; i < nuevosPuestos.length; i += BATCH) {
    const lote = nuevosPuestos.slice(i, i + BATCH);
    await supabaseFetch(`puestos_coac`, {
      method: "POST",
      headers: { "x-admin-pin": adminPin, "Prefer": "return=minimal" },
      body: JSON.stringify(lote),
    });
  }
  return { ok: true, total: nuevosPuestos.length };
}

// --- SheetJS (xlsx) cargado dinámicamente desde CDN solo cuando se necesite ---
let _xlsxPromise = null;
function cargarXLSX() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    s.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("XLSX no cargado"));
    };
    s.onerror = () => reject(new Error("No se pudo cargar SheetJS desde CDN"));
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

// Parsear archivo Excel con el formato original del COAC
// Devuelve { puestos: [{codigo, nombre, categoria, orden}], avisos: [] }
async function parsearExcelPuestos(archivo) {
  const XLSX = await cargarXLSX();
  const buf = await archivo.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  let categoriaActual = "";
  const puestos = [];
  const avisos = [];
  let orden = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila || fila.length < 2) continue;
    const codigo = (fila[0] != null ? String(fila[0]).trim() : "");
    const nombre = (fila[1] != null ? String(fila[1]).trim() : "");

    // Header
    if (codigo === "CODIGO CONTABLE" && nombre === "EQUIPO TECNICO") continue;

    // Fila totalmente vacía
    if (!codigo && !nombre) continue;

    // Fila de categoría (código vacío, nombre con texto)
    if (!codigo && nombre) {
      categoriaActual = nombre;
      continue;
    }

    // Fila de puesto
    if (codigo && nombre) {
      if (!categoriaActual) {
        avisos.push(`Fila ${i + 1}: puesto "${nombre}" sin categoría previa, se asigna "SIN CATEGORÍA"`);
        categoriaActual = "SIN CATEGORÍA";
      }
      puestos.push({ codigo, nombre, categoria: categoriaActual, orden: orden++ });
    }
  }
  return { puestos, avisos };
}


// ─────────────────────────────────────────────────────────────────────
// EXCEL MASTER: Rellenar pestaña EQUIPO TÉCNICO con un perfil
// ─────────────────────────────────────────────────────────────────────

// Convierte índice de columna (0-based) a letra Excel (A, B, ..., Z, AA, AB, ..., HZ, ...)
function colNumToLetter(n) {
  let s = "";
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode((x % 26) + 65) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

// Devuelve clave de celda tipo "A8", "AB10" a partir de col (0-based) y row (1-based)
function cellKey(col, row) {
  return colNumToLetter(col) + row;
}

// Parsea fecha de Excel: puede venir como Date, número (serial) o string
function parseFechaExcel(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial: días desde 1900-01-01 (con bug del año bisiesto 1900)
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + v);
    return d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d)) return d;
  }
  return null;
}

// Convierte fecha YYYY-MM-DD → Date local
function fechaStrToDate(s) {
  if (!s) return null;
  const partes = String(s).split("-");
  if (partes.length !== 3) return null;
  return new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
}

// Devuelve {año, mes (1-12)} de una Date
function añoMes(d) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// Detecta las columnas mensuales del Excel master
// Lee fila 3, columnas a partir de la 29 (AC, índice 28 en 0-based)
// Devuelve mapa: { "2026-04": { sueldosCol: 28, extrasCol: 29 }, ... }
// Cada mes ocupa 10 columnas: inicio + 9 más. La columna donde está la fecha en fila 3
// es la columna "AC" (2ª del bloque = SUELDOS valor). EXTRAS está 1 columna después.
function detectarMesesExcel(sheetData) {
  const fila3 = sheetData[2] || []; // 0-based: fila 3 es índice 2
  const meses = {};
  for (let ci = 28; ci < fila3.length; ci++) { // columna AC = índice 28
    const v = fila3[ci];
    const fecha = parseFechaExcel(v);
    if (fecha && fecha.getDate() === 1) {
      // Es inicio de mes. La col SUELDOS valor es esta misma columna (ci),
      // y EXTRAS está en ci+1
      const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      // Pero ojo: en realidad el "sueldos valor" calculado está en ci (que tiene fecha primer día)
      // y "extras" está en ci+1 (que tiene fecha último día). Mirando los encabezados de fila 5,
      // la columna SUELDOS (valor) coincide con la fecha primer día.
      if (!meses[key]) {
        meses[key] = { sueldosCol: ci, extrasCol: ci + 1 };
      }
    }
  }
  return meses;
}

// Borra la fórmula y mete un valor en una celda del workbook
// SheetJS: para sobrescribir, hay que asignar t (tipo) y v (value), y borrar f (formula)
function setCellValue(ws, cellKey, value) {
  // Si no existe la celda, la creamos
  if (!ws[cellKey]) ws[cellKey] = {};
  const cell = ws[cellKey];
  // Eliminar fórmula y formato calculado
  delete cell.f;
  delete cell.F; // shared formula
  if (value === null || value === undefined || value === "") {
    cell.t = "z";
    cell.v = undefined;
  } else if (value instanceof Date) {
    cell.t = "d";
    cell.v = value;
    cell.z = "yyyy-mm-dd";
  } else if (typeof value === "number") {
    cell.t = "n";
    cell.v = value;
  } else {
    cell.t = "s";
    cell.v = String(value);
  }
  return cell;
}

// Mapa de nombres de mes en español a número (1-12)
const MES_NOMBRE_A_NUM = {
  "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
  "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
};
function parseMesEspañol(s) {
  if (!s) return null;
  const partes = s.toLowerCase().trim().split(/\s+/);
  if (partes.length < 2) return null;
  const month = MES_NOMBRE_A_NUM[partes[0]];
  const year = parseInt(partes[partes.length - 1]);
  if (!month || isNaN(year)) return null;
  return { year, month };
}

// Calcula el desglose mensual desde el perfil cargado
// Devuelve: { meses: [{ key, año, mes, sueldoBase, extras }], totalVac, totalIndem, totalExtras }
function calcularDistribucionMensual(perfil) {
  const d = perfil.datos || {};
  const desglose = d._calculado?.desglose45 || d.desglose45 || d.desglose || [];
  const complementos = d._calculado?.complementos45 || d.complementos45 || d.complementos || [];
  const esT40 = perfil.tabId === "tab40";

  // Fechas de inicio para mapear cada elemento del desglose a su YYYY-MM
  const fechaIni = fechaStrToDate(d.fechaInicio);
  const fechaFin = fechaStrToDate(d.fechaFin);

  let totalVac = 0;
  let totalIndem = 0;
  let totalExtras = 0;
  const meses = [];

  for (let i = 0; i < desglose.length; i++) {
    const mes = desglose[i];
    const c = complementos[i] || {};
    const plusAct = esT40 ? 0 : (mes.plusAct || 0);

    // Sueldo base = SOLO Salario Base (sin vac ni indem)
    const sueldoBase = mes.base40 || 0;

    // Extras = todo lo que NO es base, vac, ni indem
    const extrasMes = (mes.cobroHx || 0) + plusAct
      + (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0)
      + (c.seguroVida || 0) + (c.comida || 0);

    totalVac += mes.vac40 || 0;
    totalIndem += mes.indem40 || 0;
    totalExtras += extrasMes;

    // Detectar año y mes parseando el string "abril 2026"
    let year = null, month = null;
    const parsed = parseMesEspañol(mes.mes);
    if (parsed) {
      year = parsed.year;
      month = parsed.month;
    } else if (fechaIni) {
      // Fallback: usar la fecha de inicio + índice
      const tmp = new Date(fechaIni.getFullYear(), fechaIni.getMonth() + i, 1);
      year = tmp.getFullYear();
      month = tmp.getMonth() + 1;
    }

    if (year && month) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      meses.push({ key, year, month, sueldoBase, extras: extrasMes });
    }
  }

  return { meses, totalVac, totalIndem, totalExtras, fechaIni, fechaFin };
}

// Función principal: rellena la fila destino del Excel master
async function rellenarExcelMaster(archivoMaster, perfil, filaDestino) {
  const XLSX = await cargarXLSX();
  const buf = await archivoMaster.arrayBuffer();
  // cellNF: leer formato de celdas, cellStyles: leer estilos, cellDates: parsear fechas
  const wb = XLSX.read(buf, { type: "array", cellNF: true, cellStyles: true, cellDates: true });

  const nombreHoja = "EQUIPO TÉCNICO";
  const ws = wb.Sheets[nombreHoja];
  if (!ws) {
    throw new Error(`El Excel no tiene la pestaña "${nombreHoja}"`);
  }

  // Leer datos como matriz para detectar columnas mensuales
  const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const mesesExcel = detectarMesesExcel(sheetData);

  if (Object.keys(mesesExcel).length === 0) {
    throw new Error("No se detectaron columnas mensuales en el Excel (fila 3, cols AC+)");
  }

  // Calcular distribución del perfil
  const dist = calcularDistribucionMensual(perfil);
  if (dist.meses.length === 0) {
    throw new Error("El perfil no tiene desglose mensual calculado. Recarga el perfil y guárdalo de nuevo.");
  }

  const d = perfil.datos || {};

  // ─── Rellenar bloque izquierdo ───
  // D = código contable
  setCellValue(ws, cellKey(3, filaDestino), d.codigoContable || "");
  // F = nombre
  setCellValue(ws, cellKey(5, filaDestino), d.nombre || "");
  // G = salario pactado (numérico)
  setCellValue(ws, cellKey(6, filaDestino), Number(d.salario45) || 0);
  // K = fecha inicio
  if (dist.fechaIni) setCellValue(ws, cellKey(10, filaDestino), dist.fechaIni);
  // L = fecha fin
  if (dist.fechaFin) setCellValue(ws, cellKey(11, filaDestino), dist.fechaFin);
  // N = "SS"
  setCellValue(ws, cellKey(13, filaDestino), "SS");
  // U = total vacaciones (pisa fórmula)
  setCellValue(ws, cellKey(20, filaDestino), Number(dist.totalVac) || 0);
  // V = total indemnización (pisa fórmula)
  setCellValue(ws, cellKey(21, filaDestino), Number(dist.totalIndem) || 0);
  // W = total extras anual
  setCellValue(ws, cellKey(22, filaDestino), Number(dist.totalExtras) || 0);

  // ─── Rellenar columnas mensuales ───
  const mesesEscritos = [];
  const mesesNoEncontrados = [];
  for (const m of dist.meses) {
    const cols = mesesExcel[m.key];
    if (!cols) {
      mesesNoEncontrados.push(m.key);
      continue;
    }
    // SUELDOS valor (col 2 del bloque mensual, p.ej. AC)
    setCellValue(ws, cellKey(cols.sueldosCol, filaDestino), Number(m.sueldoBase) || 0);
    // EXTRAS (col 3 del bloque mensual, p.ej. AD)
    setCellValue(ws, cellKey(cols.extrasCol, filaDestino), Number(m.extras) || 0);
    mesesEscritos.push(m.key);
  }

  // Generar archivo modificado
  const nuevoBuf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  return { buffer: nuevoBuf, mesesEscritos, mesesNoEncontrados, mesesExcel };
}


async function listarLogs(adminPin, { usuario, tipo, limit = 200 } = {}) {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));
  if (usuario) params.set("usuario_nombre", `eq.${usuario}`);
  if (tipo) params.set("tipo", `eq.${tipo}`);
  return supabaseFetch(`logs_actividad?${params}`, {
    headers: { "x-admin-pin": adminPin },
  });
}

async function borrarLogsAntiguos(adminPin, dias = 30) {
  const fechaLimite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  return supabaseFetch(`logs_actividad?created_at=lt.${fechaLimite}`, {
    method: "DELETE",
    headers: { "x-admin-pin": adminPin },
  });
}


// ═══════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGIN
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PANTALLA SELECTOR DE PROYECTO (v45)
// ═══════════════════════════════════════════════════════════════════════
function PantallaSelectorProyecto({ usuario, onSeleccionar, onLogout, onGestionar }) {
  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargar = () => {
    setCargando(true); setError(null);
    listarProyectos({
      adminPin: usuario.es_admin ? usuario.pin : null,
      usuarioId: usuario.id,
      esAdmin: usuario.es_admin,
    })
      .then(lista => {
        // Filtrar solo activos (para admins también, la selección es de trabajo)
        setProyectos((lista || []).filter(p => p.activo));
        setCargando(false);
      })
      .catch(err => { setError(err.message); setCargando(false); });
  };

  useEffect(() => { recargar(); }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a1a 0%, #2a2520 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        background: "#f0ede8", borderRadius: 12, padding: "40px 36px",
        maxWidth: 480, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid #c8a96e",
      }}>
        {/* Cabecera */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-block", width: 56, height: 56,
            background: "#c8a96e", borderRadius: 12,
            color: "#1a1a1a", fontSize: 26, fontWeight: 700,
            lineHeight: "56px", marginBottom: 14,
          }}>📁</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Selecciona Proyecto
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {usuario.nombre}{usuario.es_admin ? " · Admin" : ""}
          </div>
        </div>

        {cargando && (
          <div style={{ textAlign: "center", padding: 20, color: "#888", fontSize: 11 }}>
            Cargando proyectos...
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: "rgba(160,69,69,0.1)", border: "1px solid #a04545", borderRadius: 6, color: "#a04545", fontSize: 11, marginBottom: 12 }}>
            ✕ {error}
          </div>
        )}

        {/* Sin proyectos */}
        {!cargando && !error && proyectos.length === 0 && (
          <div style={{
            padding: 20, background: "rgba(184,134,74,0.08)", border: "1px solid #d4b678",
            borderRadius: 6, color: "#5a4a2a", fontSize: 12, textAlign: "center", lineHeight: 1.5, marginBottom: 14,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
            <b>No tienes proyectos asignados</b>
            <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
              Contacta con un administrador para que te asigne un proyecto.
            </div>
          </div>
        )}

        {/* Lista de proyectos */}
        {!cargando && proyectos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {proyectos.map(p => (
              <button
                key={p.id}
                onClick={() => onSeleccionar(p)}
                style={{
                  background: "#fff", border: "1px solid #d0ccc6",
                  borderRadius: 6, padding: "14px 16px", cursor: "pointer",
                  textAlign: "left", fontFamily: "'Courier New', monospace",
                  transition: "all 0.15s", color: "#1a1a1a",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.background = "#faf6ee"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#d0ccc6"; e.currentTarget.style.background = "#fff"; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.05em" }}>
                    {p.nombre}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {p.productora}
                  </div>
                </div>
                <div style={{ color: "#c8a96e", fontSize: 18 }}>→</div>
              </button>
            ))}
          </div>
        )}

        {/* Botones inferiores */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 14, borderTop: "1px solid #e0ddd8" }}>
          {usuario.es_admin && (
            <button
              onClick={onGestionar}
              style={{
                flex: 1, background: "#c8a96e", color: "#1a1a1a", border: "none",
                padding: "10px 14px", borderRadius: 5, cursor: "pointer",
                fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}
            >⚙ Gestionar proyectos</button>
          )}
          <button
            onClick={onLogout}
            style={{
              flex: 1, background: "transparent", color: "#888", border: "1px solid #ccc",
              padding: "10px 14px", borderRadius: 5, cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
            }}
          >Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}


function PantallaLogin({ onAcierto }) {
  const [nombres, setNombres] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [mostrarPin, setMostrarPin] = useState(false);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setErrorCarga("Supabase no configurado. Revisa las variables de entorno en Vercel.");
      setCargando(false);
      return;
    }
    listarNombres()
      .then(lista => { setNombres(lista); setCargando(false); })
      .catch(err => { setErrorCarga(err.message); setCargando(false); });
  }, []);

  const intentar = async () => {
    if (!nombre || !pin) { setError(true); setTimeout(() => setError(false), 600); return; }
    setVerificando(true);
    try {
      const user = await loginUsuario(nombre, pin);
      if (user) {
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify({
            id: user.id, nombre: user.nombre, es_admin: user.es_admin, pin,
            ultima_actividad: Date.now(),
          }));
        } catch {}
        // Registrar log de acceso (no bloqueante)
        registrarLog(user.nombre, "login");
        onAcierto({ id: user.id, nombre: user.nombre, es_admin: user.es_admin, pin });
      } else {
        setError(true); setIntentos(n => n + 1); setPin("");
        setTimeout(() => setError(false), 600);
      }
    } catch (err) {
      setErrorCarga("Error verificando: " + err.message);
    }
    setVerificando(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a1a 0%, #2a2520 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        background: "#f0ede8", borderRadius: 12, padding: "40px 36px",
        maxWidth: 380, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid #c8a96e",
        animation: error ? "shake 0.4s" : "none",
      }}>
        <style>{`
          @keyframes shake {
            0%,100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
        `}</style>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-block", width: 56, height: 56,
            background: "#c8a96e", borderRadius: 12,
            color: "#1a1a1a", fontSize: 28, fontWeight: 700,
            lineHeight: "56px", marginBottom: 14,
          }}>B</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Calculadora Salarios
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Acceso restringido
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign: "center", padding: 20, color: "#888", fontSize: 11 }}>
            Cargando usuarios...
          </div>
        ) : errorCarga ? (
          <div style={{ padding: 12, background: "rgba(160,69,69,0.1)", border: "1px solid #a04545", borderRadius: 6, color: "#a04545", fontSize: 11 }}>
            ✕ {errorCarga}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 9, color: "#666", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                Usuario
              </label>
              <select
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 16,
                  border: "1px solid #c0bcb5", borderRadius: 6, background: "#fff",
                  boxSizing: "border-box", fontFamily: "'Courier New', monospace",
                  color: "#1a1a1a", outline: "none",
                }}
              >
                <option value="">— Selecciona tu usuario —</option>
                {nombres.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 9, color: "#666", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                PIN
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={mostrarPin ? "text" : "password"}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && intentar()}
                  inputMode="numeric"
                  autoComplete="off"
                  style={{
                    width: "100%", padding: "12px 44px 12px 14px", fontSize: 16,
                    border: `1px solid ${error ? "#a04545" : "#c0bcb5"}`,
                    borderRadius: 6, background: "#fff", boxSizing: "border-box",
                    fontFamily: "'Courier New', monospace", color: "#1a1a1a",
                    letterSpacing: mostrarPin ? "normal" : "0.2em", outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPin(v => !v)}
                  style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: 8, color: "#666",
                  }}
                >
                  {mostrarPin ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <div style={{ fontSize: 10, color: "#a04545", marginTop: 8, letterSpacing: "0.08em" }}>
                  ✕ Usuario o PIN incorrectos {intentos > 2 ? `(${intentos} intentos)` : ""}
                </div>
              )}
            </div>

            <button
              onClick={intentar}
              disabled={verificando}
              style={{
                width: "100%", padding: "12px 16px",
                background: verificando ? "#666" : "#1a1a1a", color: "#f0ede8",
                border: "none", borderRadius: 6, cursor: verificando ? "wait" : "pointer",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {verificando ? "Verificando..." : "Acceder"}
            </button>
          </>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #d8d4ce", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#aaa", letterSpacing: "0.1em" }}>
            Si no tienes acceso, contacta con el administrador
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// PANEL ADMIN: GESTIÓN DE USUARIOS
// ═══════════════════════════════════════════════════════════════════════

function PanelAdmin({ usuarioActual, onCerrar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // {id, nombre, pin, es_admin}
  const [nuevoForm, setNuevoForm] = useState({ nombre: "", pin: "", es_admin: false });
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  const recargar = async () => {
    setCargando(true); setError(null);
    try {
      const lista = await listarUsuariosAdmin(usuarioActual.pin);
      setUsuarios(lista);
    } catch (err) { setError(err.message); }
    setCargando(false);
  };

  useEffect(() => { recargar(); }, []);

  const onAdd = async () => {
    if (!nuevoForm.nombre.trim() || !nuevoForm.pin.trim()) { alert("Nombre y PIN obligatorios"); return; }
    try {
      await crearUsuario(usuarioActual.pin, nuevoForm.nombre.trim(), nuevoForm.pin.trim(), nuevoForm.es_admin);
      setNuevoForm({ nombre: "", pin: "", es_admin: false });
      setMostrarNuevo(false);
      recargar();
    } catch (err) { alert("Error: " + err.message); }
  };

  const onSaveEdit = async () => {
    try {
      await actualizarUsuario(usuarioActual.pin, editando.id, {
        nombre: editando.nombre.trim(), pin: editando.pin.trim(), es_admin: editando.es_admin
      });
      setEditando(null);
      recargar();
    } catch (err) { alert("Error: " + err.message); }
  };

  const onDelete = async (u) => {
    if (u.id === usuarioActual.id) { alert("No puedes borrarte a ti mismo"); return; }
    if (!confirm(`¿Eliminar a "${u.nombre}" DEFINITIVAMENTE? Esta acción no se puede deshacer.\n\nSi solo quieres impedir el acceso temporal, usa "Desactivar".`)) return;
    try {
      await borrarUsuario(usuarioActual.pin, u.id);
      recargar();
    } catch (err) { alert("Error: " + err.message); }
  };

  const onToggleActivo = async (u) => {
    if (u.id === usuarioActual.id) { alert("No puedes desactivarte a ti mismo"); return; }
    const accion = u.activo ? "desactivar" : "activar";
    const msg = u.activo
      ? `¿Desactivar a "${u.nombre}"? No podrá hacer login pero sus datos se conservarán.`
      : `¿Reactivar a "${u.nombre}"? Podrá volver a hacer login.`;
    if (!confirm(msg)) return;
    try {
      await actualizarUsuario(usuarioActual.pin, u.id, { activo: !u.activo });
      recargar();
    } catch (err) { alert("Error al " + accion + ": " + err.message); }
  };

  // Separar activos e inactivos. Activos primero (ya ordenados por nombre desde la API).
  // Inactivos al final, también ordenados por nombre.
  const usuariosActivos = usuarios.filter(u => u.activo !== false);
  const usuariosInactivos = usuarios.filter(u => u.activo === false);
  const usuariosOrdenados = [...usuariosActivos, ...usuariosInactivos];

  const C = { padding: "8px 10px", fontSize: 11, fontFamily: "'Courier New',monospace", borderBottom: "1px solid #eae7e2" };
  const TH = { ...C, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#666", fontWeight: 700, textAlign: "left", borderBottom: "1px solid #d0ccc6" };
  const inp = { padding: "6px 8px", fontSize: 11, border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", boxSizing: "border-box" };
  const btn = (bg, color = "#fff") => ({ padding: "6px 12px", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: bg, color, border: "none", borderRadius: 4, cursor: "pointer" });
  const btnSm = (bg, color = "#fff") => ({ padding: "4px 9px", fontSize: 9, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: bg, color, border: "none", borderRadius: 3, cursor: "pointer" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "#f0ede8", borderRadius: 10, padding: 24, maxWidth: 900, width: "100%", marginTop: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a1a1a", fontFamily: "'Courier New',monospace" }}>⚙ Gestión de Usuarios</h2>
          <button onClick={onCerrar} style={btn("#1a1a1a")}>✕ Cerrar</button>
        </div>

        {error && <div style={{ padding: 10, background: "rgba(160,69,69,0.1)", border: "1px solid #a04545", borderRadius: 4, color: "#a04545", fontSize: 11, marginBottom: 12 }}>✕ {error}</div>}

        <div style={{ marginBottom: 12 }}>
          {!mostrarNuevo ? (
            <button onClick={() => setMostrarNuevo(true)} style={btn("#5a8a5a")}>+ Añadir usuario</button>
          ) : (
            <div style={{ padding: 12, background: "#fff", borderRadius: 6, border: "1px solid #d0ccc6", display: "grid", gridTemplateColumns: "1fr 100px auto auto auto", gap: 8, alignItems: "center" }}>
              <input style={inp} placeholder="Nombre" value={nuevoForm.nombre} onChange={e => setNuevoForm({ ...nuevoForm, nombre: e.target.value })} />
              <input style={inp} placeholder="PIN" value={nuevoForm.pin} onChange={e => setNuevoForm({ ...nuevoForm, pin: e.target.value })} />
              <label style={{ fontSize: 10, fontFamily: "'Courier New',monospace", display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={nuevoForm.es_admin} onChange={e => setNuevoForm({ ...nuevoForm, es_admin: e.target.checked })} /> Admin
              </label>
              <button onClick={onAdd} style={btn("#5a8a5a")}>Guardar</button>
              <button onClick={() => { setMostrarNuevo(false); setNuevoForm({ nombre: "", pin: "", es_admin: false }); }} style={btn("#888")}>Cancelar</button>
            </div>
          )}
        </div>

        {cargando ? (
          <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 11 }}>Cargando...</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", border: "1px solid #d0ccc6" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={TH}>Nombre</th>
                <th style={TH}>PIN</th>
                <th style={{ ...TH, textAlign: "center" }}>Admin</th>
                <th style={{ ...TH, textAlign: "center" }}>Estado</th>
                <th style={{ ...TH, textAlign: "right" }}>Acciones</th>
              </tr></thead>
              <tbody>
                {usuariosOrdenados.map(u => {
                  const inactivo = u.activo === false;
                  if (editando && editando.id === u.id) {
                    return (
                      <tr key={u.id}>
                        <td style={C}><input style={{ ...inp, width: "100%" }} value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} /></td>
                        <td style={C}><input style={{ ...inp, width: "100%" }} value={editando.pin} onChange={e => setEditando({ ...editando, pin: e.target.value })} /></td>
                        <td style={{ ...C, textAlign: "center" }}><input type="checkbox" checked={editando.es_admin} onChange={e => setEditando({ ...editando, es_admin: e.target.checked })} /></td>
                        <td style={{ ...C, textAlign: "center", color: "#888", fontSize: 9 }}>—</td>
                        <td style={{ ...C, textAlign: "right" }}>
                          <button onClick={onSaveEdit} style={{ ...btn("#5a8a5a"), marginRight: 4 }}>✓</button>
                          <button onClick={() => setEditando(null)} style={btn("#888")}>✕</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={u.id} style={inactivo ? { opacity: 0.55, background: "#fafaf7" } : {}}>
                      <td style={{ ...C, fontWeight: u.id === usuarioActual.id ? 700 : 400, color: inactivo ? "#888" : "#1a1a1a" }}>
                        {u.nombre}
                        {u.id === usuarioActual.id && <span style={{ fontSize: 9, color: "#888", marginLeft: 6 }}>(tú)</span>}
                      </td>
                      <td style={{ ...C, color: inactivo ? "#aaa" : "#888" }}>••••</td>
                      <td style={{ ...C, textAlign: "center" }}>{u.es_admin ? "✓" : "—"}</td>
                      <td style={{ ...C, textAlign: "center" }}>
                        {inactivo ? (
                          <span style={{ background: "rgba(136,136,136,0.15)", color: "#666", padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>⊘ INACTIVO</span>
                        ) : (
                          <span style={{ background: "rgba(90,138,90,0.15)", color: "#2a6e2a", padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>✓ ACTIVO</span>
                        )}
                      </td>
                      <td style={{ ...C, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditando({ ...u })} style={{ ...btnSm("#b8864a"), marginRight: 4 }}>✎ Editar</button>
                        {u.id !== usuarioActual.id && (
                          inactivo ? (
                            <button onClick={() => onToggleActivo(u)} style={{ ...btnSm("transparent", "#2a6e2a"), border: "1px solid #2a6e2a", marginRight: 4 }}>✓ Activar</button>
                          ) : (
                            <button onClick={() => onToggleActivo(u)} style={{ ...btnSm("transparent", "#b07030"), border: "1px solid #b07030", marginRight: 4 }}>⊘ Desactivar</button>
                          )
                        )}
                        <button onClick={() => onDelete(u)} style={btnSm("#a04545")} disabled={u.id === usuarioActual.id}>🗑 Borrar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 9, color: "#888", fontFamily: "'Courier New',monospace", letterSpacing: "0.05em", textAlign: "center" }}>
          {usuariosActivos.length} activo{usuariosActivos.length !== 1 ? "s" : ""} · {usuariosInactivos.length} inactivo{usuariosInactivos.length !== 1 ? "s" : ""} · {usuarios.length} total{usuarios.length !== 1 ? "es" : ""}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// PANEL ADMIN: VISOR DE LOGS
// ═══════════════════════════════════════════════════════════════════════

function PanelLogs({ usuarioActual, onCerrar }) {
  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [limit, setLimit] = useState(100);

  const recargar = async () => {
    setCargando(true); setError(null);
    try {
      const filtros = {};
      if (filtroTipo) filtros.tipo = filtroTipo;
      if (filtroUsuario) filtros.usuario = filtroUsuario;
      filtros.limit = limit;
      const lista = await listarLogs(usuarioActual.pin, filtros);
      setLogs(lista || []);
    } catch (err) { setError(err.message); }
    setCargando(false);
  };

  useEffect(() => { recargar(); }, [filtroTipo, filtroUsuario, limit]);

  const formatoFecha = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("es-ES", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    } catch { return iso; }
  };

  const tipoLabel = (t) => {
    if (t === "login") return { txt: "🔓 LOGIN", color: "#5a8a5a" };
    if (t === "export_csv") return { txt: "📄 CSV", color: "#b8864a" };
    if (t === "export_pdf") return { txt: "📑 PDF", color: "#a04545" };
    return { txt: t, color: "#666" };
  };

  const exportarLogsCSV = () => {
    const sep = ";";
    const lines = [];
    lines.push(["Fecha", "Usuario", "Tipo", "Detalle", "Navegador"].join(sep));
    logs.forEach(l => {
      lines.push([
        formatoFecha(l.created_at),
        l.usuario_nombre || "",
        l.tipo || "",
        (l.detalle || "").replace(/[;\n]/g, " "),
        (l.user_agent || "").replace(/[;\n]/g, " "),
      ].join(sep));
    });
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const limpiarAntiguos = async () => {
    if (!confirm("¿Borrar logs de más de 30 días? Esta acción NO se puede deshacer.")) return;
    try {
      await borrarLogsAntiguos(usuarioActual.pin, 30);
      recargar();
      alert("Logs antiguos eliminados");
    } catch (err) { alert("Error: " + err.message); }
  };

  const C = { padding: "7px 10px", fontSize: 10.5, fontFamily: "'Courier New',monospace", borderBottom: "1px solid #eae7e2", verticalAlign: "top" };
  const TH = { ...C, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#666", fontWeight: 700, textAlign: "left", borderBottom: "1px solid #d0ccc6", whiteSpace: "nowrap" };
  const inp = { padding: "6px 8px", fontSize: 11, border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", background: "#fff" };
  const btn = (bg, color = "#fff") => ({ padding: "6px 12px", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: bg, color, border: "none", borderRadius: 4, cursor: "pointer" });

  // Lista de usuarios únicos para el dropdown
  const usuariosUnicos = [...new Set(logs.map(l => l.usuario_nombre).filter(Boolean))].sort();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "#f0ede8", borderRadius: 10, padding: 24, maxWidth: 1000, width: "100%", marginTop: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 14, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a1a1a", fontFamily: "'Courier New',monospace" }}>📊 Logs de Actividad</h2>
          <button onClick={onCerrar} style={btn("#1a1a1a")}>✕ Cerrar</button>
        </div>

        {error && <div style={{ padding: 10, background: "rgba(160,69,69,0.1)", border: "1px solid #a04545", borderRadius: 4, color: "#a04545", fontSize: 11, marginBottom: 12 }}>✕ {error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select style={inp} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">— Todos los tipos —</option>
            <option value="login">🔓 Login</option>
            <option value="export_csv">📄 Export CSV</option>
            <option value="export_pdf">📑 Export PDF</option>
          </select>
          <select style={inp} value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
            <option value="">— Todos los usuarios —</option>
            {usuariosUnicos.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select style={inp} value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={500}>Últimos 500</option>
            <option value={2000}>Últimos 2000</option>
          </select>
          <button onClick={recargar} style={btn("#888")}>🔄 Refrescar</button>
          <div style={{ flex: 1 }} />
          <button onClick={exportarLogsCSV} style={btn("#5a8a5a")} disabled={logs.length === 0}>↓ Exportar CSV</button>
          <button onClick={limpiarAntiguos} style={btn("#a04545")}>🗑 Limpiar +30d</button>
        </div>

        {cargando ? (
          <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 11 }}>Cargando logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 11, background: "#fff", borderRadius: 6, border: "1px solid #d0ccc6" }}>No hay logs con los filtros seleccionados</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", border: "1px solid #d0ccc6", maxHeight: "60vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f0ede8", zIndex: 1 }}>
                <tr>
                  <th style={TH}>Fecha</th>
                  <th style={TH}>Usuario</th>
                  <th style={TH}>Tipo</th>
                  <th style={TH}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const t = tipoLabel(l.tipo);
                  return (
                    <tr key={l.id}>
                      <td style={{ ...C, color: "#666", whiteSpace: "nowrap" }}>{formatoFecha(l.created_at)}</td>
                      <td style={{ ...C, fontWeight: 600 }}>{l.usuario_nombre}</td>
                      <td style={{ ...C, color: t.color, fontWeight: 700, whiteSpace: "nowrap" }}>{t.txt}</td>
                      <td style={{ ...C, color: "#444" }}>{l.detalle || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 9, color: "#888", fontFamily: "'Courier New',monospace", letterSpacing: "0.05em", textAlign: "center" }}>
          Mostrando {logs.length} registro{logs.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// PANEL ADMIN: GESTIÓN DE PUESTOS COAC
// ═══════════════════════════════════════════════════════════════════════
function PanelPuestos({ usuarioActual, onCerrar }) {
  const [puestos, setPuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [formEdit, setFormEdit] = useState({ codigo: "", nombre: "", categoria: "" });
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ codigo: "", nombre: "", categoria: "" });
  const [importando, setImportando] = useState(false);
  const [previewImport, setPreviewImport] = useState(null); // {puestos, avisos}
  const fileInputRef = useRef(null);

  const adminPin = usuarioActual?.pin;

  const recargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarPuestosCoac();
      setPuestos(lista || []);
    } catch (e) {
      setError("Error al cargar puestos: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { recargar(); }, []);

  const showMsg = (texto, tipo = "ok") => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  };

  // Filtrado por búsqueda y categoría
  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = norm(busqueda);
  const puestosFiltrados = puestos.filter(p => {
    if (filtroCategoria && p.categoria !== filtroCategoria) return false;
    if (!q) return true;
    return norm(p.nombre).includes(q) || norm(p.codigo).includes(q) || norm(p.categoria).includes(q);
  });

  // Categorías únicas
  const categorias = [...new Set(puestos.map(p => p.categoria))].sort();

  // Editar
  const empezarEditar = (p) => {
    setEditandoId(p.id);
    setFormEdit({ codigo: p.codigo, nombre: p.nombre, categoria: p.categoria });
  };
  const cancelarEditar = () => {
    setEditandoId(null);
    setFormEdit({ codigo: "", nombre: "", categoria: "" });
  };
  const guardarEdicion = async () => {
    if (!formEdit.codigo.trim() || !formEdit.nombre.trim() || !formEdit.categoria.trim()) {
      showMsg("Todos los campos son obligatorios", "err");
      return;
    }
    try {
      await actualizarPuestoCoac(adminPin, editandoId, {
        codigo: formEdit.codigo.trim(),
        nombre: formEdit.nombre.trim(),
        categoria: formEdit.categoria.trim(),
      });
      showMsg("Puesto actualizado", "ok");
      cancelarEditar();
      await recargar();
    } catch (e) {
      showMsg("Error: " + e.message, "err");
    }
  };

  // Borrar
  const borrar = async (p) => {
    if (!confirm(`¿Borrar "${p.nombre}" (${p.codigo})?`)) return;
    try {
      await borrarPuestoCoac(adminPin, p.id);
      showMsg("Puesto borrado", "ok");
      await recargar();
    } catch (e) {
      showMsg("Error: " + e.message, "err");
    }
  };

  // Añadir manual
  const crearManual = async () => {
    if (!formNuevo.codigo.trim() || !formNuevo.nombre.trim() || !formNuevo.categoria.trim()) {
      showMsg("Todos los campos son obligatorios", "err");
      return;
    }
    try {
      const maxOrden = puestos.reduce((m, p) => Math.max(m, p.orden || 0), 0);
      await crearPuestoCoac(adminPin, {
        codigo: formNuevo.codigo.trim(),
        nombre: formNuevo.nombre.trim(),
        categoria: formNuevo.categoria.trim(),
        orden: maxOrden + 1,
      });
      showMsg("Puesto añadido", "ok");
      setFormNuevo({ codigo: "", nombre: "", categoria: "" });
      setMostrarFormNuevo(false);
      await recargar();
    } catch (e) {
      showMsg("Error: " + e.message, "err");
    }
  };

  // Importar Excel — paso 1: parsear y mostrar preview
  const onArchivoSeleccionado = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".xlsx") && !archivo.name.toLowerCase().endsWith(".xls")) {
      showMsg("Solo archivos .xlsx o .xls", "err");
      return;
    }
    setImportando(true);
    try {
      const { puestos: pst, avisos } = await parsearExcelPuestos(archivo);
      if (pst.length === 0) {
        showMsg("El archivo no contiene puestos válidos", "err");
        setImportando(false);
        return;
      }
      setPreviewImport({ puestos: pst, avisos, nombreArchivo: archivo.name });
    } catch (e) {
      showMsg("Error parseando Excel: " + e.message, "err");
    } finally {
      setImportando(false);
      // Limpiar el input para poder volver a importar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Importar Excel — paso 2: confirmar y reemplazar todos
  const confirmarImportacion = async () => {
    if (!previewImport) return;
    setImportando(true);
    try {
      await reemplazarTodosPuestos(adminPin, previewImport.puestos);
      // Registrar log
      try { registrarLog(usuarioActual.nombre, "import_puestos", `Importados ${previewImport.puestos.length} puestos de ${previewImport.nombreArchivo}`); } catch {}
      showMsg(`${previewImport.puestos.length} puestos cargados`, "ok");
      setPreviewImport(null);
      await recargar();
    } catch (e) {
      showMsg("Error importando: " + e.message, "err");
    } finally {
      setImportando(false);
    }
  };

  // Exportar Excel (backup)
  const exportarExcel = async () => {
    try {
      const XLSX = await cargarXLSX();
      // Recrear el formato original: filas de categoría intercaladas
      const filas = [["CODIGO CONTABLE", "EQUIPO TECNICO"]];
      let catActual = "";
      const ordenado = [...puestos].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      for (const p of ordenado) {
        if (p.categoria !== catActual) {
          filas.push(["", p.categoria]);
          catActual = p.categoria;
        }
        filas.push([p.codigo, p.nombre]);
      }
      const ws = XLSX.utils.aoa_to_sheet(filas);
      ws["!cols"] = [{ wch: 18 }, { wch: 50 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Puestos COAC");
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Backup_Puestos_COAC_${fecha}.xlsx`);
    } catch (e) {
      showMsg("Error exportando: " + e.message, "err");
    }
  };

  // Estilos
  const overlayStyle = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex",
    alignItems: "flex-start", justifyContent: "center", padding: "30px 16px", overflowY: "auto",
  };
  const modalStyle = {
    background: "#f0ede8", borderRadius: 8, maxWidth: 1100, width: "100%",
    fontFamily: "'Courier New',monospace", color: "#1a1a1a",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  };
  const headerStyle = {
    background: "#1a1a1a", color: "#f0e6d0", padding: "14px 18px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderRadius: "8px 8px 0 0",
  };
  const btnStyle = {
    background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e",
    padding: "5px 12px", borderRadius: 4, cursor: "pointer",
    fontSize: 10, fontFamily: "'Courier New',monospace",
    fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
  };
  const btnDanger = { ...btnStyle, color: "#c85050", borderColor: "#c85050" };
  const btnOk = { ...btnStyle, color: "#5a8a5a", borderColor: "#5a8a5a" };
  const inp = {
    padding: "7px 10px", border: "1px solid #c0bcb5", borderRadius: 4,
    fontFamily: "'Courier New',monospace", fontSize: 11, background: "#fff",
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 9, color: "#c8a96e", letterSpacing: "0.2em", textTransform: "uppercase" }}>Panel admin</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>📋 Puestos COAC</div>
          </div>
          <button onClick={onCerrar} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cerrar</button>
        </div>

        <div style={{ padding: 20 }}>
          {error && <div style={{ background: "#fde6e6", border: "1px solid #d8a0a0", color: "#7a2020", padding: "10px 14px", borderRadius: 4, marginBottom: 14, fontSize: 11 }}>{error}</div>}
          {mensaje && <div style={{ background: mensaje.tipo === "ok" ? "#e6f4e6" : "#fde6e6", border: `1px solid ${mensaje.tipo === "ok" ? "#a0d0a0" : "#d8a0a0"}`, color: mensaje.tipo === "ok" ? "#2a5a2a" : "#7a2020", padding: "10px 14px", borderRadius: 4, marginBottom: 14, fontSize: 11 }}>{mensaje.texto}</div>}

          {/* Preview de importación */}
          {previewImport && (
            <div style={{ background: "#fff3d6", border: "2px solid #c8a96e", borderRadius: 6, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7a5a2a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>⚠ Confirmar importación</div>
              <div style={{ fontSize: 12, marginBottom: 10 }}>
                Archivo: <strong>{previewImport.nombreArchivo}</strong><br/>
                Puestos a cargar: <strong>{previewImport.puestos.length}</strong><br/>
                Esto <strong style={{ color: "#a04545" }}>BORRARÁ los {puestos.length} puestos actuales</strong> y los reemplazará por los nuevos del Excel.
              </div>
              {previewImport.avisos.length > 0 && (
                <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 4, marginBottom: 10, fontSize: 10, maxHeight: 100, overflowY: "auto" }}>
                  <strong>Avisos:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {previewImport.avisos.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={confirmarImportacion} disabled={importando} style={{ ...btnDanger, padding: "8px 16px" }}>
                  {importando ? "Importando..." : "✓ Confirmar y reemplazar todo"}
                </button>
                <button onClick={() => setPreviewImport(null)} disabled={importando} style={btnStyle}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Barra de acciones */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <input
              type="text"
              placeholder="🔍 Buscar nombre, código o categoría..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...inp, flex: 1, minWidth: 220 }}
            />
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={inp}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onArchivoSeleccionado}
              style={{ display: "none" }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={importando} style={btnStyle}>📥 Importar Excel</button>
            <button onClick={exportarExcel} style={btnStyle}>📤 Exportar Excel</button>
            <button onClick={() => setMostrarFormNuevo(!mostrarFormNuevo)} style={btnOk}>+ Añadir</button>
          </div>

          {/* Formulario nuevo */}
          {mostrarFormNuevo && (
            <div style={{ background: "#fff", border: "1px solid #c8a96e", borderRadius: 6, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#7a5a2a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Nuevo puesto</div>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr auto", gap: 8 }}>
                <input type="text" placeholder="Código" value={formNuevo.codigo} onChange={e => setFormNuevo({ ...formNuevo, codigo: e.target.value })} style={inp} />
                <input type="text" placeholder="Nombre" value={formNuevo.nombre} onChange={e => setFormNuevo({ ...formNuevo, nombre: e.target.value })} style={inp} />
                <input type="text" placeholder="Categoría" value={formNuevo.categoria} onChange={e => setFormNuevo({ ...formNuevo, categoria: e.target.value })} list="cats-nuevo" style={inp} />
                <datalist id="cats-nuevo">
                  {categorias.map(c => <option key={c} value={c} />)}
                </datalist>
                <button onClick={crearManual} style={btnOk}>✓ Crear</button>
              </div>
            </div>
          )}

          {/* Lista */}
          {cargando ? (
            <div style={{ textAlign: "center", padding: 30, color: "#888", fontSize: 11 }}>Cargando puestos...</div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e0ddd8", borderRadius: 6, maxHeight: 500, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr 110px", gap: 8, padding: "8px 12px", background: "#f0ede8", borderBottom: "1px solid #d0ccc6", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontWeight: 700, position: "sticky", top: 0 }}>
                <div>Código</div><div>Nombre</div><div>Categoría</div><div style={{ textAlign: "right" }}>Acciones</div>
              </div>
              {puestosFiltrados.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 11, fontStyle: "italic" }}>
                  {puestos.length === 0 ? "No hay puestos. Importa un Excel o añade manualmente." : "Sin resultados con los filtros aplicados."}
                </div>
              ) : (
                puestosFiltrados.map(p => editandoId === p.id ? (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr 110px", gap: 8, padding: "7px 12px", borderBottom: "1px solid #eae7e2", background: "#fff8e6", alignItems: "center" }}>
                    <input type="text" value={formEdit.codigo} onChange={e => setFormEdit({ ...formEdit, codigo: e.target.value })} style={{ ...inp, padding: "4px 6px" }} />
                    <input type="text" value={formEdit.nombre} onChange={e => setFormEdit({ ...formEdit, nombre: e.target.value })} style={{ ...inp, padding: "4px 6px" }} />
                    <input type="text" value={formEdit.categoria} onChange={e => setFormEdit({ ...formEdit, categoria: e.target.value })} list="cats-edit" style={{ ...inp, padding: "4px 6px" }} />
                    <datalist id="cats-edit">
                      {categorias.map(c => <option key={c} value={c} />)}
                    </datalist>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button onClick={guardarEdicion} title="Guardar" style={{ ...btnOk, padding: "3px 8px", fontSize: 9 }}>✓</button>
                      <button onClick={cancelarEditar} title="Cancelar" style={{ ...btnStyle, padding: "3px 8px", fontSize: 9 }}>✗</button>
                    </div>
                  </div>
                ) : (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr 110px", gap: 8, padding: "7px 12px", borderBottom: "1px solid #eae7e2", fontSize: 11, alignItems: "center" }}>
                    <div style={{ color: "#888", fontFamily: "'Courier New',monospace" }}>{p.codigo}</div>
                    <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                    <div style={{ color: "#666", fontSize: 10 }}>{p.categoria}</div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button onClick={() => empezarEditar(p)} title="Editar" style={{ ...btnStyle, padding: "3px 8px", fontSize: 9 }}>✏</button>
                      <button onClick={() => borrar(p)} title="Borrar" style={{ ...btnDanger, padding: "3px 8px", fontSize: 9 }}>🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 10, color: "#888", textAlign: "center" }}>
            {puestosFiltrados.length} de {puestos.length} puesto{puestos.length !== 1 ? "s" : ""}
            {categorias.length > 0 && ` · ${categorias.length} categorías`}
          </div>

          <div style={{ marginTop: 14, padding: "10px 14px", background: "#fafaf7", borderRadius: 4, border: "1px solid #e0ddd8", fontSize: 10, color: "#666", lineHeight: 1.6 }}>
            <strong style={{ color: "#444" }}>Formato Excel:</strong> El importador acepta el formato original del Listado COAC: columna A "CODIGO CONTABLE", columna B "EQUIPO TECNICO", con filas de categoría intercaladas (código vacío, nombre = categoría).<br/>
            <strong style={{ color: "#a04545" }}>⚠ Importar REEMPLAZA todos los puestos existentes.</strong> Exporta primero un backup si quieres conservarlos.
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// PESTAÑA "COSTE EMPRESA" — solo admin
// ═══════════════════════════════════════════════════════════════════════

function CosteEmpresa() {
  const usuarioCtx = useContext(UsuarioContext);
  const proyectoActivoCtx = useContext(ProyectoContext); // v45
  const [perfiles, setPerfiles] = useState([]);
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true);
  const [perfilCargado, setPerfilCargado] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos"); // "todos" | "45h" | "40h"

  // IRPF Plus Vivienda (empresa lo asume?)
  const [irpfActivo, setIrpfActivo] = useState(false);
  const [pctIRPF, setPctIRPF] = useState("");

  // Gestoría: ¿hay firma de contrato en el primer mes?
  // Por defecto SÍ (32€ primer mes = 6 alta + 26 nómina)
  // Si se desactiva: primer mes = 26€ (solo nómina)
  const [firmaContrato, setFirmaContrato] = useState(true);

  // Importe exento por baja médica (no suma a base SS/IMEI/Solidaridad)
  const [bajaActiva, setBajaActiva] = useState(false);
  const [importeExento, setImporteExento] = useState(""); // string para input
  const [mesesExentos, setMesesExentos] = useState({}); // { "2026-04": true, ... }

  // Modal exportar a Excel master
  const [mostrarExportMaster, setMostrarExportMaster] = useState(false);
  const [archivoMaster, setArchivoMaster] = useState(null);
  const [filaDestinoExcel, setFilaDestinoExcel] = useState("8");
  const [procesandoMaster, setProcesandoMaster] = useState(false);
  const [errorMaster, setErrorMaster] = useState(null);
  const inputMasterRef = useRef(null);

  // Adaptador de storage (igual que en GestorPerfiles)
  const storage = (() => {
    if (typeof window !== "undefined" && window.storage) return window.storage;
    return {
      list: async (prefix) => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        return { keys };
      },
      get: async (key) => {
        const value = localStorage.getItem(key);
        if (value === null) throw new Error("Not found");
        return { value };
      },
      set: async (key, value) => {
        localStorage.setItem(key, value);
        return { key, value };
      },
    };
  })();

  // Cargar todos los perfiles (v46: Supabase + localStorage)
  useEffect(() => {
    (async () => {
      try {
        // v46: Cargar de Supabase (admin ve por defecto proyecto activo, con toggle "ver todos")
        // Como CosteEmpresa es solo admin, cargamos todos los tabs y todos los proyectos por defecto
        // (más simple: mostrar todos, ya tienen el buscador y filtro por tipo)
        const perfilesSup = await listarPerfilesSupabase({
          tabId: null,
          verTodos: true,
          adminPin: usuarioCtx?.pin,
        });
        let listaFinal = [];
        if (Array.isArray(perfilesSup)) {
          listaFinal = perfilesSup.map(p => ({
            key: `sup_${p.id}`,
            supabaseId: p.id,
            proyectoId: p.proyecto_id,
            nombre: p.nombre,
            tabId: p.tab_id === "45h" ? "iruna45" : p.tab_id === "40h" ? "tab40" : p.tab_id,
            timestamp: new Date(p.created_at).getTime(),
            autor: p.autor,
            datos: p.datos,
            fuente: "supabase",
          }));
        }

        // localStorage (respaldo/antiguos)
        const prefijos = ["perfil_unif_", "perfil_40h_", "perfil_45h_"];
        const todasKeys = [];
        for (const prefix of prefijos) {
          try {
            const res = await storage.list(prefix);
            if (res && res.keys) todasKeys.push(...res.keys);
          } catch {}
        }
        const lista = await Promise.all(todasKeys.map(async k => {
          try {
            const d = await storage.get(k);
            const data = JSON.parse(d.value);
            let tabId = data.tabId;
            if (!tabId) {
              if (k.startsWith("perfil_45h_")) tabId = "iruna45";
              else if (k.startsWith("perfil_40h_")) tabId = "tab40";
            }
            return { key: k, fuente: "local", ...data, tabId };
          } catch { return null; }
        }));
        // Fusionar sin duplicados
        const claves = new Set(listaFinal.map(p => `${p.nombre}::${p.timestamp}`));
        for (const p of lista.filter(Boolean)) {
          const k = `${p.nombre}::${p.timestamp}`;
          if (!claves.has(k)) {
            listaFinal.push(p);
            claves.add(k);
          }
        }
        setPerfiles(listaFinal.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      } catch (e) {
        console.error("Error cargando perfiles:", e);
      }
      setCargandoPerfiles(false);
    })();
  }, []);

  const fmtFecha = (ts) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  };

  const fmt = (n) => {
    if (typeof n !== "number" || isNaN(n)) return "0,00";
    return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Devuelve etiqueta "45H" o "40H" según tabId
  const tipoLabel = (tabId) => {
    if (tabId === "tab40") return { txt: "40H", color: "#3a6898" };
    return { txt: "45H", color: "#b8864a" }; // iruna45 o desconocido = 45H
  };

  // Perfiles filtrados por búsqueda y tipo
  const perfilesFiltrados = perfiles.filter(p => {
    if (filtroTipo === "45h" && p.tabId !== "iruna45") return false;
    if (filtroTipo === "40h" && p.tabId !== "tab40") return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    const trabajador = p.datos?.nombre || "";
    const proyecto = p.datos?.proyecto || "";
    return (
      (p.nombre || "").toLowerCase().includes(q) ||
      trabajador.toLowerCase().includes(q) ||
      proyecto.toLowerCase().includes(q)
    );
  });

  const cargarPerfil = (p) => {
    setPerfilCargado(p);

    // Cargar configuración de coste empresa guardada con el perfil (si la hay)
    const ce = p.datos?._costeEmpresa || {};
    setIrpfActivo(!!ce.irpfActivo);
    setPctIRPF(ce.pctIRPF != null ? String(ce.pctIRPF) : "");
    setFirmaContrato(ce.firmaContrato !== undefined ? !!ce.firmaContrato : true); // default ON
    setBajaActiva(!!ce.bajaActiva);
    setImporteExento(ce.importeExento != null ? String(ce.importeExento) : "");
    setMesesExentos(ce.mesesExentos || {});

    // Registrar log
    if (usuarioCtx) {
      const detalle = `[Coste Empresa] Cargado: ${p.nombre} (${p.tabId === "tab40" ? "40H" : "45H"})`;
      try { registrarLog(usuarioCtx.nombre, "cargar_coste_empresa", detalle); } catch {}
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAR CSV / PDF de Coste Empresa
  // ═══════════════════════════════════════════════════════════════════

  // Genera filename base (proyecto_productora_trabajador_costeempresa)
  const generarFilename = () => {
    if (!perfilCargado) return "costeempresa";
    const d = perfilCargado.datos || {};
    const partes = [d.proyecto, d.productora, d.nombre, "costeempresa"]
      .filter(Boolean)
      .map(s => String(s).replace(/[^a-zA-Z0-9]/g, "_"));
    return partes.join("_") || "costeempresa";
  };

  // Calcula todas las filas de coste empresa (reutilizable)
  const calcularFilas = () => {
    if (!perfilCargado) return { filas: [], totales: null, totalBruto: 0 };
    const d = perfilCargado.datos || {};
    const desglose = d._calculado?.desglose45 || d.desglose45 || d.desglose || [];
    const complementos = d._calculado?.complementos45 || d.complementos45 || d.complementos || [];
    const esT40 = perfilCargado.tabId === "tab40";
    const pctIRPFNum = parseFloat(pctIRPF) || 0;
    const importeExentoNum = parseFloat(importeExento) || 0;

    const filas = desglose.map((mes, i) => {
      const c = complementos[i] || {};
      const plusAct = esT40 ? 0 : (mes.plusAct || 0);
      const total = (mes.base40 || 0) + (mes.vac40 || 0) + (mes.indem40 || 0) + (mes.cobroHx || 0) + plusAct + (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0) + (c.seguroVida || 0) + (c.comida || 0);

      // Determinar si este mes tiene exención aplicada
      const parsed = parseMesEspañol(mes.mes);
      const claveMes = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}` : null;
      const aplicaExencion = bajaActiva && importeExentoNum > 0 && claveMes && mesesExentos[claveMes];
      const exentoMes = aplicaExencion ? importeExentoNum : 0;

      const ce = calcularCosteEmpresaMes({
        total,
        vacaciones: mes.vac40 || 0,
        indem: mes.indem40 || 0,
        horasExtraEur: mes.cobroHx || 0,
        plusVivienda: c.vivienda || 0,
        irpfActivo,
        pctIRPF: pctIRPFNum,
        esPrimerMes: i === 0,
        importeExento: exentoMes,
        firmaContrato,
      });
      return {
        mes: mes.mes,
        claveMes,
        esCompleto: mes.esCompleto,
        desde: mes.desde,
        hasta: mes.hasta,
        // Importes percibe trabajador
        base: mes.base40 || 0,
        vac: mes.vac40 || 0,
        indem: mes.indem40 || 0,
        hx: mes.cobroHx || 0,
        plusAct,
        coche: c.coche || 0,
        vivienda: c.vivienda || 0,
        seguroVida: c.seguroVida || 0,
        comida: c.comida || 0,
        total,
        // Coste empresa
        ...ce,
      };
    });

    const totales = filas.reduce((acc, f) => ({
      base: acc.base + f.base,
      vac: acc.vac + f.vac,
      indem: acc.indem + f.indem,
      hx: acc.hx + f.hx,
      plusAct: acc.plusAct + f.plusAct,
      coche: acc.coche + f.coche,
      vivienda: acc.vivienda + f.vivienda,
      seguroVida: acc.seguroVida + f.seguroVida,
      comida: acc.comida + f.comida,
      total: acc.total + f.total,
      exento: acc.exento + (f.exento || 0),
      ssPrincipal: acc.ssPrincipal + f.ssPrincipal,
      ssVacaciones: acc.ssVacaciones + f.ssVacaciones,
      ssHorasExtra: acc.ssHorasExtra + f.ssHorasExtra,
      imei: acc.imei + f.imei,
      solidaridad: acc.solidaridad + f.solidaridad,
      irpfVivienda: acc.irpfVivienda + f.irpfVivienda,
      gestoria: acc.gestoria + f.gestoria,
      totalCosteEmpresa: acc.totalCosteEmpresa + f.totalCosteEmpresa,
    }), { base: 0, vac: 0, indem: 0, hx: 0, plusAct: 0, coche: 0, vivienda: 0, seguroVida: 0, comida: 0, total: 0, exento: 0, ssPrincipal: 0, ssVacaciones: 0, ssHorasExtra: 0, imei: 0, solidaridad: 0, irpfVivienda: 0, gestoria: 0, totalCosteEmpresa: 0 });

    return { filas, totales, totalBruto: totales.total };
  };

  const exportarCSV = () => {
    if (!perfilCargado) { alert("Carga un perfil primero"); return; }
    const { filas, totales } = calcularFilas();
    if (filas.length === 0) { alert("Este perfil no tiene datos mensuales"); return; }

    const d = perfilCargado.datos || {};
    const tipo = perfilCargado.tabId === "tab40" ? "40H" : "45H";
    const sep = ";";
    const dec = (n) => (typeof n === "number" && !isNaN(n)) ? n.toFixed(2).replace(".", ",") : "0,00";
    const lines = [];

    lines.push([`COSTE EMPRESA · ${tipo}`].join(sep));
    if (usuarioCtx) lines.push(["Generado por", `${usuarioCtx.nombre} · ${new Date().toLocaleString("es-ES")}`].join(sep));
    lines.push([""].join(sep));
    lines.push(["Perfil", perfilCargado.nombre || "—"].join(sep));
    lines.push(["Proyecto", d.proyecto || "—"].join(sep));
    lines.push(["Productora", d.productora || "—"].join(sep));
    lines.push(["Trabajador", d.nombre || "—"].join(sep));
    lines.push(["Puesto", d.puesto || "—"].join(sep));
    lines.push(["Código Contable", d.codigoContable || "—"].join(sep));
    lines.push(["Salario pactado", dec(Number(d.salario45) || 0) + " EUR"].join(sep));
    lines.push(["Periodo", (d.fechaInicio && d.fechaFin) ? `${d.fechaInicio} a ${d.fechaFin}` : "—"].join(sep));
    lines.push(["Modo vacaciones", d.vacAcumulada ? "Al final" : "Prorrateadas"].join(sep));
    lines.push(["Modo indemnizacion", d.indemAcumulada ? "Al final" : "Prorrateada"].join(sep));
    lines.push(["IRPF Plus Vivienda", irpfActivo ? `Empresa asume (${parseFloat(pctIRPF) || 0}%)` : "Trabajador"].join(sep));
    lines.push([""].join(sep));

    lines.push(["LO QUE PERCIBE EL TRABAJADOR (mensual)"].join(sep));
    lines.push(["Mes","Salario Base","Vacaciones","Indemnizacion","H.Extra EUR","Plus Actividad","Coche","Vivienda","Seguro Vida","Comida","Exento","TOTAL"].join(sep));
    filas.forEach(f => {
      lines.push([
        f.mes + (f.esCompleto ? "" : ` (${f.desde}-${f.hasta})`),
        dec(f.base), dec(f.vac), dec(f.indem), dec(f.hx), dec(f.plusAct),
        dec(f.coche), dec(f.vivienda), dec(f.seguroVida), dec(f.comida), dec(f.exento || 0), dec(f.total),
      ].join(sep));
    });
    lines.push([
      "TOTAL", dec(totales.base), dec(totales.vac), dec(totales.indem), dec(totales.hx),
      dec(totales.plusAct), dec(totales.coche), dec(totales.vivienda),
      dec(totales.seguroVida), dec(totales.comida), dec(totales.exento || 0), dec(totales.total)
    ].join(sep));
    lines.push([""].join(sep));

    lines.push(["COSTE EMPRESA (mensual)"].join(sep));
    lines.push(["Mes","SS Principal (33,35%)","SS Vacaciones (33,35%)","SS H.Extra (27%)","IMEI (0,75%)","Solidaridad","IRPF Vivienda","Gestoria","Exento aplicado","TOTAL Coste Empresa"].join(sep));
    filas.forEach(f => {
      lines.push([
        f.mes + (f.esCompleto ? "" : ` (${f.desde}-${f.hasta})`),
        dec(f.ssPrincipal), dec(f.ssVacaciones), dec(f.ssHorasExtra),
        dec(f.imei), dec(f.solidaridad), dec(f.irpfVivienda),
        dec(f.gestoria), dec(f.exento || 0), dec(f.totalCosteEmpresa),
      ].join(sep));
    });
    lines.push([
      "TOTAL", dec(totales.ssPrincipal), dec(totales.ssVacaciones), dec(totales.ssHorasExtra),
      dec(totales.imei), dec(totales.solidaridad), dec(totales.irpfVivienda),
      dec(totales.gestoria), dec(totales.exento || 0), dec(totales.totalCosteEmpresa),
    ].join(sep));
    lines.push([""].join(sep));

    lines.push(["RESUMEN"].join(sep));
    lines.push(["Bruto trabajador", dec(totales.total) + " EUR"].join(sep));
    lines.push(["Coste empresa", dec(totales.totalCosteEmpresa) + " EUR"].join(sep));
    if (bajaActiva && (parseFloat(importeExento) || 0) > 0) {
      lines.push(["Importe exento mensual", dec(parseFloat(importeExento) || 0) + " EUR"].join(sep));
      lines.push(["Total exento aplicado", dec(totales.exento || 0) + " EUR"].join(sep));
    }
    lines.push(["Firma de contrato", firmaContrato ? "SI" : "NO"].join(sep));
    lines.push(["Coste total", dec(totales.total + totales.totalCosteEmpresa) + " EUR"].join(sep));
    const pct = totales.total > 0 ? (totales.totalCosteEmpresa / totales.total * 100) : 0;
    lines.push(["% s/salario", pct.toFixed(2).replace(".", ",") + " %"].join(sep));

    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generarFilename() + ".csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (usuarioCtx) {
      try { registrarLog(usuarioCtx.nombre, "export_csv", `[Coste Empresa] ${generarFilename()}.csv · ${d.nombre || "—"}`); } catch {}
    }
  };

  const exportarPDF = () => {
    if (!perfilCargado) { alert("Carga un perfil primero"); return; }
    const { filas, totales } = calcularFilas();
    if (filas.length === 0) { alert("Este perfil no tiene datos mensuales"); return; }

    const d = perfilCargado.datos || {};
    const tipo = perfilCargado.tabId === "tab40" ? "40H" : "45H";
    const titulo = [d.proyecto, d.productora, d.nombre].filter(Boolean).join(" - ") || "Coste Empresa";
    const pctIRPFNum = parseFloat(pctIRPF) || 0;
    const totalConCE = totales.total + totales.totalCosteEmpresa;
    const pctSobre = totales.total > 0 ? (totales.totalCosteEmpresa / totales.total * 100) : 0;
    const generadoEl = new Date().toLocaleString("es-ES");

    const filasPerc = filas.map(f => `
      <tr>
        <td class="m">${f.mes}${f.esCompleto ? "" : ` <span class="small">(${f.desde}-${f.hasta})</span>`}</td>
        <td class="n">${fmt(f.base)}</td>
        <td class="n ${f.vac === 0 ? 'z' : ''}">${f.vac === 0 ? "—" : fmt(f.vac)}</td>
        <td class="n ${f.indem === 0 ? 'z' : ''}">${f.indem === 0 ? "—" : fmt(f.indem)}</td>
        <td class="n ${f.hx === 0 ? 'z' : 'b'}">${f.hx === 0 ? "—" : fmt(f.hx)}</td>
        <td class="n ${f.plusAct === 0 ? 'z' : 'o'}">${f.plusAct === 0 ? "—" : fmt(f.plusAct)}</td>
        <td class="n ${f.coche === 0 ? 'z' : 'g'}">${f.coche === 0 ? "—" : fmt(f.coche)}</td>
        <td class="n ${f.vivienda === 0 ? 'z' : 'g'}">${f.vivienda === 0 ? "—" : fmt(f.vivienda)}</td>
        <td class="n ${f.seguroVida === 0 ? 'z' : 'g'}">${f.seguroVida === 0 ? "—" : fmt(f.seguroVida)}</td>
        <td class="n ${f.comida === 0 ? 'z' : 'g'}">${f.comida === 0 ? "—" : fmt(f.comida)}</td>
        <td class="n ${(f.exento || 0) === 0 ? 'z' : 'red'}"><b>${(f.exento || 0) === 0 ? "—" : "-" + fmt(f.exento)}</b></td>
        <td class="n gold"><b>${fmt(f.total)}</b></td>
      </tr>
    `).join("");

    const filasCE = filas.map(f => `
      <tr>
        <td class="m">${f.mes}</td>
        <td class="n ${f.ssPrincipal === 0 ? 'z' : ''}">${f.ssPrincipal === 0 ? "—" : fmt(f.ssPrincipal)}</td>
        <td class="n ${f.ssVacaciones === 0 ? 'z' : ''}">${f.ssVacaciones === 0 ? "—" : fmt(f.ssVacaciones)}</td>
        <td class="n ${f.ssHorasExtra === 0 ? 'z' : 'b'}">${f.ssHorasExtra === 0 ? "—" : fmt(f.ssHorasExtra)}</td>
        <td class="n ${f.imei === 0 ? 'z' : ''}">${f.imei === 0 ? "—" : fmt(f.imei)}</td>
        <td class="n ${f.solidaridad === 0 ? 'z' : 'p'}">${f.solidaridad === 0 ? "—" : fmt(f.solidaridad)}</td>
        <td class="n ${f.irpfVivienda === 0 ? 'z' : 'o'}">${f.irpfVivienda === 0 ? "—" : fmt(f.irpfVivienda)}</td>
        <td class="n g">${fmt(f.gestoria)}</td>
        <td class="n ${(f.exento || 0) === 0 ? 'z' : 'red'}">${(f.exento || 0) === 0 ? "—" : "-" + fmt(f.exento)}</td>
        <td class="n red"><b>${fmt(f.totalCosteEmpresa)}</b></td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${generarFilename()}_CosteEmpresa</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: 'Courier New', monospace; color: #1a1a1a; font-size: 8.5px; margin: 0; padding: 0; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg); font-weight: 900; color: rgba(160, 69, 69, 0.10); letter-spacing: 0.15em; z-index: 9999; pointer-events: none; text-align: center; white-space: nowrap; line-height: 0.95; }
  .watermark .wm1 { font-size: 90px; display: block; }
  .watermark .wm2 { font-size: 38px; display: block; letter-spacing: 0.20em; margin-top: 6px; }
  .content { position: relative; z-index: 1; }
  .banner { background: #1a1a1a; color: #f0e6d0; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 12px; }
  .logo { background: #c8a96e; color: #1a1a1a; padding: 5px 8px; font-weight: 700; letter-spacing: 0.1em; border-radius: 3px; font-size: 9px; }
  .title-right { text-align: right; }
  .subtitle { font-size: 7px; color: #c8a96e; letter-spacing: 0.25em; text-transform: uppercase; }
  .title { font-size: 12px; font-weight: 700; letter-spacing: 0.07em; }
  .meta { font-size: 7px; color: #aaa; margin-top: 2px; }
  .section { margin-bottom: 12px; }
  h2 { font-size: 8px; letter-spacing: 0.18em; color: #b8864a; text-transform: uppercase; margin: 0 0 6px; padding-bottom: 5px; border-bottom: 1px solid #e0ddd8; }
  h2.red { color: #a04545; }
  .datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .datos > div { background: #fafaf7; border: 1px solid #e0ddd8; border-radius: 3px; padding: 5px 7px; }
  .datos .l { font-size: 6.5px; color: #888; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px; }
  .datos .v { font-size: 9px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 7px; table-layout: fixed; }
  th { background: #f0ede8; color: #666; font-size: 6.5px; letter-spacing: 0.03em; text-transform: uppercase; font-weight: 700; padding: 4px 2px; border-bottom: 1px solid #d0ccc6; text-align: right; word-wrap: break-word; }
  th.first { text-align: left; }
  th.gold { color: #b8864a; }
  th.red { color: #a04545; }
  th .pct { display: block; font-weight: 400; font-size: 6px; color: #999; margin-top: 1px; }
  td { padding: 3px 2px; border-bottom: 1px solid #eae7e2; word-wrap: break-word; }
  td.m { font-weight: 600; text-transform: capitalize; font-size: 7px; }
  td.n { text-align: right; }
  td.b { color: #3a6898; }
  td.o { color: #b07030; }
  td.g { color: #5a8a5a; }
  td.p { color: #6a3a9a; }
  td.gold { color: #b8864a; }
  td.red { color: #a04545; }
  td.z { color: #ccc; }
  .small { font-size: 6px; color: #888; }
  tr.total td { background: #fdf8f0; font-weight: 700; border-top: 1.5px solid #d8a8a8; }
  tr.total td.first { color: #6a2020; text-transform: uppercase; letter-spacing: 0.08em; font-size: 7px; }
  .ce table tr.total td { background: #fdf0f0; }
  .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 8px; }
  .resumen > div { background: #f0ede8; border: 1px solid #e0ddd8; border-radius: 3px; padding: 6px; text-align: center; }
  .resumen .l { font-size: 6.5px; color: #666; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
  .resumen .v { font-size: 10px; font-weight: 700; }
  .resumen .vL { font-size: 12px; font-weight: 700; }
  .reglas { margin-top: 10px; padding: 8px 10px; background: #fafaf7; border: 1px solid #e0ddd8; border-radius: 3px; font-size: 7.5px; color: #666; line-height: 1.5; }
  .reglas b { color: #444; }
  .legal { margin-top: 14px; padding: 10px 12px; background: #fafaf7; border: 1px solid #e8e4de; border-radius: 3px; }
  .legal h3 { font-size: 8px; color: #888; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 6px; }
  .legal .brand { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
  .legal p { font-size: 7.5px; color: #666; line-height: 1.4; margin: 0 0 4px; }
  .legal .en { font-size: 7px; color: #888; font-style: italic; }
  .legal .footer { font-size: 7px; color: #888; font-style: italic; }
  .footer-pdf { margin-top: 10px; text-align: center; font-size: 7px; color: #aaa; letter-spacing: 0.05em; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
  .no-print { background: #faf6ee; border: 1px solid #d8c8a0; border-radius: 4px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
  .no-print button { background: #1a1a1a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; font-size: 10px; cursor: pointer; }
</style>
</head>
<body>
<div class="watermark"><span class="wm1">CONFIDENCIAL</span><span class="wm2">USO INTERNO</span></div>
<div class="content">

<div class="no-print">
  <span style="font-size:11px;color:#7a5a2a">Pulsa imprimir o "Guardar como PDF" para descargar este documento.</span>
  <button onclick="window.print()">📄 Imprimir / Guardar PDF</button>
</div>

<div class="banner">
  <div class="logo">BD PROD TOOLS</div>
  <div class="title-right">
    <div class="subtitle">Coste Empresa · ${tipo}</div>
    <div class="title">CALCULADORA DE SALARIOS</div>
    <div class="meta">${[d.nombre, d.puesto].filter(Boolean).join(" · ")}</div>
  </div>
</div>

<div class="section">
  <h2>▸ Datos del Trabajador</h2>
  <div class="datos">
    <div><div class="l">Perfil</div><div class="v">${perfilCargado.nombre || "—"}</div></div>
    <div><div class="l">Proyecto</div><div class="v">${d.proyecto || "—"}</div></div>
    <div><div class="l">Productora</div><div class="v">${d.productora || "—"}</div></div>
    <div><div class="l">Trabajador</div><div class="v">${d.nombre || "—"}</div></div>
    <div><div class="l">Puesto</div><div class="v">${d.puesto || "—"}</div></div>
    <div><div class="l">Código contable</div><div class="v">${d.codigoContable || "—"}</div></div>
    <div><div class="l">Salario pactado</div><div class="v">${d.salario45 ? fmt(Number(d.salario45)) + " €" : "—"}</div></div>
    <div><div class="l">Período</div><div class="v">${(d.fechaInicio && d.fechaFin) ? `${d.fechaInicio} → ${d.fechaFin}` : "—"}</div></div>
    <div><div class="l">Vacaciones</div><div class="v">${d.vacAcumulada ? "Al final" : "Prorrateadas"}</div></div>
    <div><div class="l">IRPF Vivienda</div><div class="v">${irpfActivo ? `Empresa (${pctIRPFNum}%)` : "Trabajador"}</div></div>
  </div>
</div>

<div class="section">
  <h2>▸ Lo que Percibe el Trabajador (Mensual · Brutos)</h2>
  <table>
    <thead>
      <tr>
        <th class="first">Mes</th>
        <th>Salario Base</th>
        <th>Vacaciones</th>
        <th>Indem.</th>
        <th>H.Extra €</th>
        <th>Plus Act.</th>
        <th>Coche</th>
        <th>Vivienda</th>
        <th>Seguro V.</th>
        <th>Comida</th>
        <th class="red">Exento</th>
        <th class="gold">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${filasPerc}
      <tr class="total">
        <td class="first">TOTAL</td>
        <td class="n">${fmt(totales.base)}</td>
        <td class="n">${fmt(totales.vac)}</td>
        <td class="n">${fmt(totales.indem)}</td>
        <td class="n b">${fmt(totales.hx)}</td>
        <td class="n o">${totales.plusAct === 0 ? "—" : fmt(totales.plusAct)}</td>
        <td class="n g">${fmt(totales.coche)}</td>
        <td class="n g">${fmt(totales.vivienda)}</td>
        <td class="n g">${fmt(totales.seguroVida)}</td>
        <td class="n g">${fmt(totales.comida)}</td>
        <td class="n red">${(totales.exento || 0) === 0 ? "—" : "-" + fmt(totales.exento)}</td>
        <td class="n gold">${fmt(totales.total)}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="section ce">
  <h2 class="red">▸ Coste Empresa (Mensual)</h2>
  <table>
    <thead>
      <tr>
        <th class="first">Mes</th>
        <th>SS Principal<span class="pct">33,35%</span></th>
        <th>SS Vac<span class="pct">33,35%</span></th>
        <th>SS H.Ex<span class="pct">27%</span></th>
        <th>IMEI<span class="pct">0,75%</span></th>
        <th>Solidaridad</th>
        <th>IRPF Viv<span class="pct">${irpfActivo && pctIRPFNum > 0 ? pctIRPFNum + "%" : "—"}</span></th>
        <th>Gestoría</th>
        <th class="red">Exento</th>
        <th class="red">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${filasCE}
      <tr class="total">
        <td class="first">TOTAL</td>
        <td class="n">${fmt(totales.ssPrincipal)}</td>
        <td class="n">${fmt(totales.ssVacaciones)}</td>
        <td class="n b">${fmt(totales.ssHorasExtra)}</td>
        <td class="n">${fmt(totales.imei)}</td>
        <td class="n p">${totales.solidaridad === 0 ? "—" : fmt(totales.solidaridad)}</td>
        <td class="n o">${totales.irpfVivienda === 0 ? "—" : fmt(totales.irpfVivienda)}</td>
        <td class="n g">${fmt(totales.gestoria)}</td>
        <td class="n red">${(totales.exento || 0) === 0 ? "—" : "-" + fmt(totales.exento)}</td>
        <td class="n red">${fmt(totales.totalCosteEmpresa)}</td>
      </tr>
    </tbody>
  </table>

  <div class="reglas">
    <b>Reglas aplicadas:</b><br/>
    · <b>SS Principal</b> (33,35%): sobre TOTAL del mes − vacaciones − indemnización. Topada a 1.701,25 € si base &gt; 5.101,20 €.<br/>
    · <b>SS Vacaciones</b> (33,35%) y <b>SS H.Extra</b> (27%): siempre se suman aparte, independientes del tope.<br/>
    · <b>IMEI</b> (0,75%): sobre TOTAL del mes − indemnización. Topado a 38,26 € si base &gt; 5.101,20 €.<br/>
    · <b>Solidaridad</b> (tramos 0,97% / 1,15% / 1,33%): sobre exceso de (TOTAL − indemnización − vacaciones − horas extra) sobre 5.101,20 €.<br/>
    · <b>Indemnización</b>: NO genera SS ni IMEI.<br/>
    · <b>Gestoría</b>: primer mes 32 € (alta + nómina), resto 26 €.
  </div>

  <div class="resumen">
    <div><div class="l">Bruto trabajador</div><div class="v">${fmt(totales.total)} €</div></div>
    <div><div class="l">Coste empresa</div><div class="v" style="color:#a04545">${fmt(totales.totalCosteEmpresa)} €</div></div>
    <div><div class="l">Coste total</div><div class="vL" style="color:#b8864a">${fmt(totalConCE)} €</div></div>
    <div><div class="l">% s/salario</div><div class="v" style="color:#6a3a9a">${pctSobre.toFixed(2)} %</div></div>
  </div>
</div>

<div class="legal">
  <h3>▸ Aviso Legal</h3>
  <div class="brand">BD PROD TOOLS</div>
  <p>${DISCLAIMER_ES}</p>
  <p class="en">${DISCLAIMER_EN}</p>
  <p class="footer">G &amp; G Enterprises LLC</p>
</div>

<div class="footer-pdf">
  Generado por ${usuarioCtx?.nombre || "—"} · ${generadoEl} · ${DISCLAIMER_PDF}
</div>

</div>
<script>
  // Auto-lanzar el diálogo de impresión al cargar
  window.addEventListener("load", function() {
    setTimeout(function() { window.print(); }, 400);
  });
</script>
</body>
</html>`;

    // Abrir en nueva ventana y auto-imprimir
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const nuevaVentana = window.open(url, "_blank");
    if (!nuevaVentana) {
      // Bloqueado por popup: fallback a descarga
      const a = document.createElement("a");
      a.href = url;
      a.download = generarFilename() + ".html";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert("⚠ El navegador bloqueó la ventana emergente. Se ha descargado el HTML. Permite ventanas emergentes para esta web y el PDF se abrirá directamente.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    if (usuarioCtx) {
      try { registrarLog(usuarioCtx.nombre, "export_pdf", `[Coste Empresa] ${generarFilename()}.html · ${d.nombre || "—"}`); } catch {}
    }
  };

  // ─── Guardar configuración Coste Empresa en el perfil cargado ───
  const guardarConfigCosteEmpresa = async () => {
    if (!perfilCargado) { alert("Carga un perfil primero"); return; }
    try {
      // Recuperar el perfil del storage, actualizar _costeEmpresa, y volver a guardar
      const key = perfilCargado.key;
      const item = await storage.get(key);
      if (!item || !item.value) { alert("No se pudo leer el perfil"); return; }
      const data = JSON.parse(item.value);
      data.datos = data.datos || {};
      data.datos._costeEmpresa = {
        irpfActivo,
        pctIRPF: parseFloat(pctIRPF) || 0,
        firmaContrato,
        bajaActiva,
        importeExento: parseFloat(importeExento) || 0,
        mesesExentos,
        guardadoEl: new Date().toISOString(),
        guardadoPor: usuarioCtx?.nombre || null,
      };
      // Guardar de vuelta
      if (storage.set) {
        await storage.set(key, JSON.stringify(data));
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
      // Actualizar el perfilCargado en memoria
      setPerfilCargado({ ...perfilCargado, datos: data.datos });
      alert("✓ Configuración guardada en el perfil");
      if (usuarioCtx) {
        try { registrarLog(usuarioCtx.nombre, "guardar_config_coste_empresa", `[Coste Empresa] ${data.nombre || "—"}`); } catch {}
      }
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  // ─── Exportar a Excel master (rellena fila en EQUIPO TÉCNICO) ───
  const abrirModalExportMaster = () => {
    if (!perfilCargado) { alert("Carga un perfil primero"); return; }
    setErrorMaster(null);
    setArchivoMaster(null);
    setFilaDestinoExcel("8");
    setMostrarExportMaster(true);
  };

  const onArchivoMasterSeleccionado = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx") && !f.name.toLowerCase().endsWith(".xlsm")) {
      setErrorMaster("Solo se aceptan archivos .xlsx o .xlsm");
      return;
    }
    setArchivoMaster(f);
    setErrorMaster(null);
  };

  const procesarExcelMaster = async () => {
    if (!perfilCargado || !archivoMaster) return;
    const fila = parseInt(filaDestinoExcel);
    if (isNaN(fila) || fila < 8 || fila > 500) {
      setErrorMaster("Fila destino debe ser un número entre 8 y 500");
      return;
    }
    setProcesandoMaster(true);
    setErrorMaster(null);
    try {
      const { buffer, mesesEscritos, mesesNoEncontrados, mesesExcel } =
        await rellenarExcelMaster(archivoMaster, perfilCargado, fila);

      // Descargar
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nombreOrig = archivoMaster.name.replace(/\.(xlsx|xlsm)$/i, "");
      const partes = [perfilCargado.datos?.nombre, "rellenado"].filter(Boolean).map(s => String(s).replace(/[^a-zA-Z0-9]/g, "_"));
      a.href = url;
      a.download = `${nombreOrig}_${partes.join("_")}.xlsx`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Log
      if (usuarioCtx) {
        try {
          registrarLog(usuarioCtx.nombre, "export_excel_master",
            `[Excel Master] ${perfilCargado.datos?.nombre || "—"} · Fila ${fila} · ${mesesEscritos.length} meses`);
        } catch {}
      }

      // Mensaje al usuario
      let msg = `✓ Excel generado. Fila ${fila} rellenada con ${mesesEscritos.length} meses.`;
      if (mesesNoEncontrados.length > 0) {
        msg += `\n\n⚠ ${mesesNoEncontrados.length} meses del perfil NO se encontraron en el Excel: ${mesesNoEncontrados.join(", ")}`;
        msg += `\n\nMeses disponibles en el Excel: ${Object.keys(mesesExcel).sort().join(", ")}`;
      }
      alert(msg);
      setMostrarExportMaster(false);
    } catch (e) {
      setErrorMaster("Error: " + e.message);
    } finally {
      setProcesandoMaster(false);
    }
  };

  // Estilo común
  const P = { background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: 8, padding: 24, marginBottom: 20, minWidth: 0 };
  const ST = { fontSize: 10, letterSpacing: "0.2em", color: "#b8864a", textTransform: "uppercase", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #e0ddd8" };

  // === Si no hay perfil cargado: solo selector ===
  if (!perfilCargado) {
    return (
      <div style={{ color: "#1a1a1a", fontFamily: "'Courier New',monospace", padding: "32px 32px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
          <div style={{ background: "#1a1a1a", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#f0e6d0", borderRadius: 8 }}>
            <div style={{ background: "#c8a96e", color: "#1a1a1a", padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em" }}>BD PROD TOOLS</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#c8a96e", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 4 }}>Coste Empresa</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.07em" }}>CALCULADORA DE SALARIOS</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={P}>
            <div style={ST}>▸ Cargar Perfil Guardado</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="🔍 Buscar perfil, trabajador o proyecto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 11, background: "#f0ede8" }}
              />
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 11, background: "#f0ede8" }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="45h">Solo 45H</option>
                <option value="40h">Solo 40H</option>
              </select>
            </div>

            {cargandoPerfiles ? (
              <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 11 }}>Cargando perfiles...</div>
            ) : perfilesFiltrados.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 11, fontStyle: "italic" }}>
                {perfiles.length === 0 ? "No hay perfiles guardados. Guarda uno desde 45H o 40H." : "No hay perfiles que coincidan con los filtros."}
              </div>
            ) : (
              <div style={{ border: "1px solid #e0ddd8", borderRadius: 6, overflow: "hidden" }}>
                {perfilesFiltrados.map((p, idx) => {
                  const t = tipoLabel(p.tabId);
                  const trabajador = p.datos?.nombre || "—";
                  const puesto = p.datos?.puesto || "—";
                  const autor = p.autor || "—";
                  return (
                    <div key={p.key} style={{ padding: "10px 14px", borderBottom: idx < perfilesFiltrados.length - 1 ? "1px solid #eae7e2" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      onClick={() => cargarPerfil(p)}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>
                          {p.nombre} <span style={{ background: t.color, color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 8, marginLeft: 4, letterSpacing: "0.05em" }}>{t.txt}</span>
                        </div>
                        <div style={{ fontSize: 9.5, color: "#888", marginTop: 2 }}>
                          {trabajador} · {puesto} · {fmtFecha(p.timestamp)} · por {autor}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); cargarPerfil(p); }}
                        style={{ background: "transparent", color: "#b8864a", border: "1px solid #b8864a", padding: "5px 12px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
                      >
                        Cargar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 9, color: "#888", textAlign: "center" }}>
              {perfilesFiltrados.length} de {perfiles.length} perfil{perfiles.length !== 1 ? "es" : ""} guardado{perfiles.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div style={{ textAlign: "center", padding: 30, color: "#aaa", fontStyle: "italic", fontSize: 11, background: "#fff", borderRadius: 8, border: "1px dashed #d0ccc6" }}>
            ⬆ Carga un perfil para empezar a calcular el coste empresa
          </div>
        </div>
      </div>
    );
  }

  // === Perfil cargado: mostrar datos + tabla "Lo que percibe el trabajador" ===
  const d = perfilCargado.datos || {};
  const esTab40 = perfilCargado.tabId === "tab40";
  const tipo = tipoLabel(perfilCargado.tabId);

  // Reconstruir desglose mensual usando los datos del perfil
  // Como FASE 1 no recalcula, mostramos los datos guardados o, si no están,
  // un placeholder. Los importes Base/Vac/Indem por mes están en d.desglose
  // si el perfil los guardó (lo hace el GestorPerfiles).
  const desgloseGuardado = d._calculado?.desglose45 || d.desglose45 || d.desglose || [];
  const complementosGuardado = d._calculado?.complementos45 || d.complementos45 || d.complementos || [];

  return (
    <div style={{ color: "#1a1a1a", fontFamily: "'Courier New',monospace", padding: "32px 32px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
        <div style={{ background: "#1a1a1a", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#f0e6d0", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#c8a96e", color: "#1a1a1a", padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em" }}>BD PROD TOOLS</div>
            <div>
              <div style={{ fontSize: 9, color: "#c8a96e", letterSpacing: "0.2em", textTransform: "uppercase" }}>Perfil cargado</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                {perfilCargado.nombre} <span style={{ background: tipo.color, color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 8, marginLeft: 4, letterSpacing: "0.05em" }}>{tipo.txt}</span>
              </div>
              <div style={{ fontSize: 9.5, color: "#aaa", marginTop: 2 }}>
                {d.nombre || "—"} · {d.puesto || "—"} · {fmtFecha(perfilCargado.timestamp)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={exportarCSV}
              style={{ background: "transparent", color: "#5a8a5a", border: "1px solid #5a8a5a", padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
              title="Descargar CSV"
            >
              📊 CSV
            </button>
            <button
              onClick={exportarPDF}
              style={{ background: "transparent", color: "#d8a0a0", border: "1px solid #a04545", padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
              title="Generar PDF (se abre en otra ventana para imprimir o guardar como PDF)"
            >
              📄 PDF
            </button>
            <button
              onClick={abrirModalExportMaster}
              style={{ background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e", padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
              title="Rellenar fila en el Excel Master (EQUIPO TÉCNICO)"
            >
              📋 Excel Master
            </button>
            <button
              onClick={guardarConfigCosteEmpresa}
              style={{ background: "transparent", color: "#3a6898", border: "1px solid #3a6898", padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
              title="Guardar la configuración actual (IRPF, firma, baja) en el perfil"
            >
              💾 Guardar Config
            </button>
            <button
              onClick={() => setPerfilCargado(null)}
              style={{ background: "transparent", color: "#aaa", border: "1px solid #555", padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
            >
              ← Cambiar perfil
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Bloque Datos del trabajador */}
        <div style={P}>
          <div style={ST}>▸ Datos del Trabajador</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {[
              { l: "Proyecto", v: d.proyecto },
              { l: "Productora", v: d.productora },
              { l: "Trabajador", v: d.nombre },
              { l: "Puesto", v: d.puesto },
              { l: "Código contable", v: d.codigoContable },
              { l: "Salario pactado", v: d.salario45 ? `${fmt(Number(d.salario45))} €` : "—" },
              { l: "Período", v: (d.fechaInicio && d.fechaFin) ? `${d.fechaInicio} → ${d.fechaFin}` : "—" },
            ].map(it => (
              <div key={it.l} style={{ background: "#f0ede8", borderRadius: 6, padding: "10px 12px", border: "1px solid #e0ddd8" }}>
                <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{it.l}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{it.v || "—"}</div>
              </div>
            ))}
          </div>

          {/* Toggle IRPF Plus Vivienda (cuando empresa lo asume) */}
          <div style={{ background: "#faf6ee", border: "1px solid #d8c8a0", borderRadius: 6, padding: "10px 14px", marginTop: 12, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: "0 0 auto" }}>
              <span style={{ position: "relative", display: "inline-block", width: 38, height: 20, background: irpfActivo ? "#2a6e2a" : "#bbb", borderRadius: 10, transition: "background 0.15s" }}>
                <span style={{ position: "absolute", top: 2, left: irpfActivo ? 20 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left 0.15s" }} />
              </span>
              <input type="checkbox" checked={irpfActivo} onChange={e => setIrpfActivo(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.05em" }}>
                La empresa asume el IRPF del Plus Vivienda
              </span>
            </label>
            {irpfActivo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <label style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em" }}>% IRPF trabajador:</label>
                <input
                  type="text"
                  value={pctIRPF}
                  onChange={e => {
                    const v = e.target.value.replace(",", ".");
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setPctIRPF(v);
                  }}
                  placeholder="ej: 18"
                  style={{ width: 60, padding: "5px 8px", border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700, textAlign: "right" }}
                />
                <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>%</span>
              </div>
            )}
          </div>

          {/* Toggle Firma de Contrato (afecta gestoría del primer mes) */}
          <div style={{ background: "#f0f5ee", border: "1px solid #c8d8b8", borderRadius: 6, padding: "10px 14px", marginTop: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: "0 0 auto" }}>
              <span style={{ position: "relative", display: "inline-block", width: 38, height: 20, background: firmaContrato ? "#2a6e2a" : "#bbb", borderRadius: 10, transition: "background 0.15s" }}>
                <span style={{ position: "absolute", top: 2, left: firmaContrato ? 20 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left 0.15s" }} />
              </span>
              <input type="checkbox" checked={firmaContrato} onChange={e => setFirmaContrato(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.05em" }}>
                Firma de contrato en primer mes
              </span>
            </label>
            <div style={{ fontSize: 9.5, color: "#666", marginLeft: "auto", fontStyle: "italic" }}>
              {firmaContrato ? "Primer mes: 32 € (6 alta + 26 nómina)" : "Primer mes: 26 € (sólo nómina)"}
            </div>
          </div>

          {/* Toggle Baja médica (importe exento de SS/IMEI/Solidaridad) */}
          <div style={{ background: "#f5eeee", border: "1px solid #d8c0c0", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: "0 0 auto" }}>
                <span style={{ position: "relative", display: "inline-block", width: 38, height: 20, background: bajaActiva ? "#a04545" : "#bbb", borderRadius: 10, transition: "background 0.15s" }}>
                  <span style={{ position: "absolute", top: 2, left: bajaActiva ? 20 : 2, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left 0.15s" }} />
                </span>
                <input type="checkbox" checked={bajaActiva} onChange={e => setBajaActiva(e.target.checked)} style={{ display: "none" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.05em" }}>
                  Hay baja médica (importe exento de SS)
                </span>
              </label>
              {bajaActiva && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <label style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em" }}>Importe mensual exento:</label>
                  <input
                    type="text"
                    value={importeExento}
                    onChange={e => {
                      const v = e.target.value.replace(",", ".");
                      if (v === "" || /^\d*\.?\d*$/.test(v)) setImporteExento(v);
                    }}
                    placeholder="ej: 600"
                    style={{ width: 80, padding: "5px 8px", border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700, textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>€</span>
                </div>
              )}
            </div>

            {/* Casillas mes a mes — se renderizan después porque dependen del desglose del perfil cargado */}
            {bajaActiva && (() => {
              const desgloseTmp = perfilCargado?.datos?._calculado?.desglose45 || perfilCargado?.datos?.desglose45 || perfilCargado?.datos?.desglose || [];
              if (desgloseTmp.length === 0) return null;
              return (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #d8c0c0" }}>
                  <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
                    Aplicar exención en estos meses:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {desgloseTmp.map((mes, i) => {
                      const parsed = parseMesEspañol(mes.mes);
                      const clave = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}` : `idx-${i}`;
                      const activo = !!mesesExentos[clave];
                      return (
                        <label key={clave} style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 4, cursor: "pointer",
                          background: activo ? "#a04545" : "#fff",
                          color: activo ? "#fff" : "#555",
                          border: `1px solid ${activo ? "#a04545" : "#d0ccc6"}`,
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                          textTransform: "capitalize",
                          transition: "all 0.15s",
                        }}>
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={e => setMesesExentos(prev => ({ ...prev, [clave]: e.target.checked }))}
                            style={{ display: "none" }}
                          />
                          {activo ? "✓ " : ""}{mes.mes}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9, color: "#7a2020", fontStyle: "italic" }}>
                    El importe exento se restará de las bases de SS Principal, IMEI y Cuota Solidaridad en los meses marcados.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Tabla mensual "Lo que percibe el trabajador" */}
        <div style={P}>
          <div style={{ ...ST, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>▸ Lo que Percibe el Trabajador (Mensual)</span>
            <span style={{ fontSize: 9, color: "#888", textTransform: "none", letterSpacing: "0.05em" }}>Brutos · {desgloseGuardado.length} mes{desgloseGuardado.length !== 1 ? "es" : ""}</span>
          </div>

          {desgloseGuardado.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 11, fontStyle: "italic" }}>
              Este perfil no contiene datos mensuales calculados. Por favor, abre el perfil en su pestaña original (45H o 40H), recalcula y guarda de nuevo.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  <tr style={{ background: "#f0ede8" }}>
                    {["Mes", "Salario Base", "Vacaciones", "Indemnización", "H.Extra €", "Plus Act.", "Coche", "Vivienda", "Seguro Vida", "Comida", "Exento", "TOTAL"].map(h => (
                      <th key={h} style={{ padding: "8px 6px", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, textAlign: h === "Mes" ? "left" : "right", color: h === "TOTAL" ? "#b8864a" : (h === "Exento" ? "#a04545" : "#666"), borderBottom: "1px solid #d0ccc6", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {desgloseGuardado.map((mes, i) => {
                    const c = complementosGuardado[i] || {};
                    const plusAct = esTab40 ? 0 : (mes.plusAct || 0);
                    const totalMes = (mes.base40 || 0) + (mes.vac40 || 0) + (mes.indem40 || 0) + (mes.cobroHx || 0) + plusAct + (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0) + (c.seguroVida || 0) + (c.comida || 0);

                    // Exención del mes
                    const parsed = parseMesEspañol(mes.mes);
                    const claveMes = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}` : null;
                    const importeExentoNum = parseFloat(importeExento) || 0;
                    const aplicaExencion = bajaActiva && importeExentoNum > 0 && claveMes && mesesExentos[claveMes];
                    const exentoMes = aplicaExencion ? importeExentoNum : 0;

                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #eae7e2" }}>
                        <td style={{ padding: "7px 6px", fontWeight: 600, textTransform: "capitalize" }}>
                          {mes.mes}{!mes.esCompleto && <span style={{ fontSize: 8, color: "#888", marginLeft: 4 }}>({mes.desde}-{mes.hasta})</span>}
                        </td>
                        <td style={{ padding: "7px 6px", textAlign: "right" }}>{fmt(mes.base40 || 0)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (mes.vac40 || 0) === 0 ? "#bbb" : "#1a1a1a" }}>{(mes.vac40 || 0) === 0 ? "—" : fmt(mes.vac40)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (mes.indem40 || 0) === 0 ? "#bbb" : "#1a1a1a" }}>{(mes.indem40 || 0) === 0 ? "—" : fmt(mes.indem40)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (mes.cobroHx || 0) === 0 ? "#bbb" : "#3a6898" }}>{(mes.cobroHx || 0) === 0 ? "—" : fmt(mes.cobroHx)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: plusAct === 0 ? "#bbb" : "#b07030" }}>{plusAct === 0 ? "—" : fmt(plusAct)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (c.coche || 0) === 0 ? "#bbb" : "#5a8a5a" }}>{(c.coche || 0) === 0 ? "—" : fmt(c.coche)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (c.vivienda || 0) === 0 ? "#bbb" : "#5a8a5a" }}>{(c.vivienda || 0) === 0 ? "—" : fmt(c.vivienda)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (c.seguroVida || 0) === 0 ? "#bbb" : "#5a8a5a" }}>{(c.seguroVida || 0) === 0 ? "—" : fmt(c.seguroVida)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (c.comida || 0) === 0 ? "#bbb" : "#5a8a5a" }}>{(c.comida || 0) === 0 ? "—" : fmt(c.comida)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: exentoMes === 0 ? "#bbb" : "#a04545", fontWeight: exentoMes > 0 ? 700 : 400 }}>{exentoMes === 0 ? "—" : `-${fmt(exentoMes)}`}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, color: "#b8864a" }}>{fmt(totalMes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════════ TABLA COSTE EMPRESA ════════ */}
        {desgloseGuardado.length > 0 && (() => {
          const pctIRPFNum = parseFloat(pctIRPF) || 0;
          const importeExentoNum = parseFloat(importeExento) || 0;
          // Calcular coste empresa para cada mes
          const filas = desgloseGuardado.map((mes, i) => {
            const c = complementosGuardado[i] || {};
            const plusAct = esTab40 ? 0 : (mes.plusAct || 0);
            const total = (mes.base40 || 0) + (mes.vac40 || 0) + (mes.indem40 || 0) + (mes.cobroHx || 0) + plusAct + (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0) + (c.seguroVida || 0) + (c.comida || 0);

            // Exención mes a mes
            const parsed = parseMesEspañol(mes.mes);
            const claveMes = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}` : null;
            const aplicaExencion = bajaActiva && importeExentoNum > 0 && claveMes && mesesExentos[claveMes];
            const exentoMes = aplicaExencion ? importeExentoNum : 0;

            const ce = calcularCosteEmpresaMes({
              total,
              vacaciones: mes.vac40 || 0,
              indem: mes.indem40 || 0,
              horasExtraEur: mes.cobroHx || 0,
              plusVivienda: c.vivienda || 0,
              irpfActivo,
              pctIRPF: pctIRPFNum,
              esPrimerMes: i === 0,
              importeExento: exentoMes,
              firmaContrato,
            });
            return { mes: mes.mes, claveMes, ...ce, total };
          });

          // Totales
          const T = filas.reduce((acc, f) => ({
            ssPrincipal: acc.ssPrincipal + f.ssPrincipal,
            ssVacaciones: acc.ssVacaciones + f.ssVacaciones,
            ssHorasExtra: acc.ssHorasExtra + f.ssHorasExtra,
            imei: acc.imei + f.imei,
            solidaridad: acc.solidaridad + f.solidaridad,
            irpfVivienda: acc.irpfVivienda + f.irpfVivienda,
            gestoria: acc.gestoria + f.gestoria,
            exento: acc.exento + (f.exento || 0),
            totalCosteEmpresa: acc.totalCosteEmpresa + f.totalCosteEmpresa,
          }), { ssPrincipal: 0, ssVacaciones: 0, ssHorasExtra: 0, imei: 0, solidaridad: 0, irpfVivienda: 0, gestoria: 0, exento: 0, totalCosteEmpresa: 0 });

          const cellNum = (v, color) => (
            <td style={{ padding: "7px 5px", textAlign: "right", color: v === 0 ? "#ccc" : (color || "#1a1a1a"), fontFamily: "'Courier New',monospace" }}>
              {v === 0 ? "—" : fmt(v)}
            </td>
          );

          return (
            <div style={{ ...P, borderColor: "#d8c0c0" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#a04545", textTransform: "uppercase", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e8d0d0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span>▸ Coste Empresa (Mensual)</span>
                <span style={{ fontSize: 9, color: "#888", textTransform: "none", letterSpacing: "0.05em" }}>Importes que paga la empresa</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: "#f5e9e9" }}>
                      <th style={{ padding: "8px 5px", textAlign: "left", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>Mes</th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>SS Principal<br/><span style={{ fontWeight: 400, fontSize: 8, color: "#a04545" }}>33,35%</span></th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>SS Vac<br/><span style={{ fontWeight: 400, fontSize: 8, color: "#a04545" }}>33,35%</span></th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>SS H.Ex<br/><span style={{ fontWeight: 400, fontSize: 8, color: "#a04545" }}>27%</span></th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>IMEI<br/><span style={{ fontWeight: 400, fontSize: 8, color: "#a04545" }}>0,75%</span></th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>Solidaridad</th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>IRPF Viv<br/><span style={{ fontWeight: 400, fontSize: 8, color: "#a04545" }}>{irpfActivo && pctIRPFNum > 0 ? `${pctIRPFNum}%` : "—"}</span></th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6a2020", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>Gestoría</th>
                      <th style={{ padding: "8px 5px", textAlign: "right", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#a04545", fontWeight: 700, borderBottom: "1px solid #d8b0b0", whiteSpace: "nowrap" }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eae7e2" }}>
                        <td style={{ padding: "7px 5px", fontWeight: 600, textTransform: "capitalize" }}>{f.mes}</td>
                        {cellNum(f.ssPrincipal)}
                        {cellNum(f.ssVacaciones)}
                        {cellNum(f.ssHorasExtra, "#3a6898")}
                        {cellNum(f.imei)}
                        {cellNum(f.solidaridad, "#6a3a9a")}
                        {cellNum(f.irpfVivienda, "#b07030")}
                        <td style={{ padding: "7px 5px", textAlign: "right", color: "#5a8a5a", fontFamily: "'Courier New',monospace" }}>{fmt(f.gestoria)}</td>
                        <td style={{ padding: "7px 5px", textAlign: "right", fontWeight: 700, color: "#a04545", fontFamily: "'Courier New',monospace" }}>{fmt(f.totalCosteEmpresa)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#fdf0f0", borderTop: "2px solid #d8a8a8" }}>
                      <td style={{ padding: "9px 5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, color: "#6a2020" }}>TOTAL</td>
                      {cellNum(T.ssPrincipal)}
                      {cellNum(T.ssVacaciones)}
                      {cellNum(T.ssHorasExtra, "#3a6898")}
                      {cellNum(T.imei)}
                      {cellNum(T.solidaridad, "#6a3a9a")}
                      {cellNum(T.irpfVivienda, "#b07030")}
                      <td style={{ padding: "9px 5px", textAlign: "right", fontWeight: 700, color: "#5a8a5a", fontFamily: "'Courier New',monospace" }}>{fmt(T.gestoria)}</td>
                      <td style={{ padding: "9px 5px", textAlign: "right", fontWeight: 700, color: "#a04545", fontSize: 12, fontFamily: "'Courier New',monospace" }}>{fmt(T.totalCosteEmpresa)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notas explicativas */}
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#fafaf7", borderRadius: 4, border: "1px solid #e0ddd8", fontSize: 9.5, color: "#666", lineHeight: 1.6 }}>
                <strong style={{ color: "#444" }}>Reglas aplicadas:</strong><br/>
                · <strong>SS Principal</strong> (33,35%): sobre TOTAL del mes − vacaciones − indemnización. Topada a 1.701,25 € si base &gt; 5.101,20 €.<br/>
                · <strong>SS Vacaciones</strong> (33,35%) y <strong>SS H.Extra</strong> (27%): siempre se suman aparte, independientes del tope.<br/>
                · <strong>IMEI</strong> (0,75%): sobre TOTAL del mes − indemnización. Topado a 38,26 € si base &gt; 5.101,20 €.<br/>
                · <strong>Solidaridad</strong> (tramos 0,97% / 1,15% / 1,33%): sobre exceso de (TOTAL − indemnización − vacaciones − horas extra) sobre 5.101,20 €.<br/>
                · <strong>Indemnización</strong>: NO genera SS ni IMEI.<br/>
                · <strong>Gestoría</strong>: primer mes 32 € (alta + nómina), resto 26 €.
              </div>

              {/* Comparativa rápida */}
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {(() => {
                  // Total bruto trabajador
                  const totalBruto = desgloseGuardado.reduce((sum, mes, i) => {
                    const c = complementosGuardado[i] || {};
                    const plusAct = esTab40 ? 0 : (mes.plusAct || 0);
                    return sum + (mes.base40 || 0) + (mes.vac40 || 0) + (mes.indem40 || 0) + (mes.cobroHx || 0) + plusAct + (c.herramienta || 0) + (c.coche || 0) + (c.vivienda || 0) + (c.seguroVida || 0) + (c.comida || 0);
                  }, 0);
                  const totalConCE = totalBruto + T.totalCosteEmpresa;
                  const pctSobreSalario = totalBruto > 0 ? (T.totalCosteEmpresa / totalBruto * 100) : 0;
                  return [
                    { l: "Bruto trabajador", v: fmt(totalBruto) + " €", color: "#1a1a1a" },
                    { l: "Coste empresa", v: fmt(T.totalCosteEmpresa) + " €", color: "#a04545" },
                    { l: "Coste total", v: fmt(totalConCE) + " €", color: "#b8864a", bold: true },
                    { l: "% s/salario", v: pctSobreSalario.toFixed(2) + " %", color: "#6a3a9a" },
                  ].map(it => (
                    <div key={it.l} style={{ background: "#f0ede8", borderRadius: 6, padding: "10px 14px", border: "1px solid #e0ddd8", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{it.l}</div>
                      <div style={{ fontSize: it.bold ? 16 : 14, fontWeight: 700, color: it.color, fontFamily: "'Courier New',monospace" }}>{it.v}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          );
        })()}

        {/* Aviso Legal (solo visible cuando hay perfil cargado) */}
        <div style={{ ...P, background: "#fafaf7", border: "1px solid #e8e4de" }}>
          <div style={{ ...ST, color: "#888", marginBottom: 10 }}>▸ Aviso Legal</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Courier New',monospace", marginBottom: 8, letterSpacing: "0.05em" }}>
            BD PROD TOOLS
          </div>
          <div style={{ fontSize: 9, color: "#666", fontFamily: "'Courier New',monospace", lineHeight: 1.5, marginBottom: 8 }}>
            {DISCLAIMER_ES}
          </div>
          <div style={{ fontSize: 8, color: "#888", fontFamily: "'Courier New',monospace", lineHeight: 1.5, fontStyle: "italic", marginBottom: 8 }}>
            {DISCLAIMER_EN}
          </div>
          <div style={{ fontSize: 8, color: "#888", fontFamily: "'Courier New',monospace", lineHeight: 1.5, fontStyle: "italic" }}>
            G &amp; G Enterprises LLC
          </div>
        </div>
      </div>

      {/* MODAL: Exportar a Excel Master */}
      {mostrarExportMaster && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !procesandoMaster) setMostrarExportMaster(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
        >
          <div style={{ background: "#f0ede8", borderRadius: 8, maxWidth: 600, width: "100%", fontFamily: "'Courier New',monospace", color: "#1a1a1a", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ background: "#1a1a1a", color: "#f0e6d0", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "8px 8px 0 0" }}>
              <div>
                <div style={{ fontSize: 9, color: "#c8a96e", letterSpacing: "0.2em", textTransform: "uppercase" }}>Coste empresa</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>📋 Rellenar Excel Master</div>
              </div>
              <button
                onClick={() => !procesandoMaster && setMostrarExportMaster(false)}
                disabled={procesandoMaster}
                style={{ background: "transparent", color: "#aaa", border: "1px solid #444", padding: "6px 14px", borderRadius: 4, cursor: procesandoMaster ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: procesandoMaster ? 0.5 : 1 }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>
                Esta opción rellena una fila en la pestaña <strong>EQUIPO TÉCNICO</strong> del Excel Master con los datos del perfil <strong>"{perfilCargado?.datos?.nombre || "—"}"</strong>.
              </div>

              {errorMaster && (
                <div style={{ background: "#fde6e6", border: "1px solid #d8a0a0", color: "#7a2020", padding: "10px 14px", borderRadius: 4, marginBottom: 14, fontSize: 11 }}>
                  {errorMaster}
                </div>
              )}

              {/* Paso 1: Seleccionar archivo */}
              <div style={{ background: "#fff", border: "1px solid #e0ddd8", borderRadius: 6, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#7a5a2a", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>1. Excel Master original</div>
                <input
                  ref={inputMasterRef}
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={onArchivoMasterSeleccionado}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => inputMasterRef.current?.click()}
                    disabled={procesandoMaster}
                    style={{ background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e", padding: "6px 14px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace" }}
                  >
                    📤 Seleccionar archivo
                  </button>
                  <div style={{ fontSize: 11, color: archivoMaster ? "#1a1a1a" : "#888", fontWeight: archivoMaster ? 700 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {archivoMaster ? archivoMaster.name : "Ningún archivo"}
                  </div>
                </div>
              </div>

              {/* Paso 2: Fila destino */}
              <div style={{ background: "#fff", border: "1px solid #e0ddd8", borderRadius: 6, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#7a5a2a", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>2. Fila destino</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number"
                    min="8"
                    max="500"
                    value={filaDestinoExcel}
                    onChange={(e) => setFilaDestinoExcel(e.target.value)}
                    disabled={procesandoMaster}
                    style={{ width: 80, padding: "6px 10px", border: "1px solid #c0bcb5", borderRadius: 4, fontFamily: "'Courier New',monospace", fontSize: 12, fontWeight: 700, textAlign: "center" }}
                  />
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5 }}>
                    En qué fila del Excel se rellenan los datos.<br/>
                    Por defecto fila 8 (primera fila tras encabezados).
                  </div>
                </div>
              </div>

              {/* Aviso */}
              <div style={{ background: "#fff8e6", border: "1px solid #d8c8a0", borderRadius: 4, padding: 10, marginBottom: 14, fontSize: 9.5, color: "#7a5a2a", lineHeight: 1.5 }}>
                <strong>⚠ Importante:</strong> esta operación pisa las fórmulas de las columnas D, F, G, K, L, N, U, V, W de la fila destino, y rellena SUELDOS + EXTRAS de cada mes del contrato. Las fórmulas de SS, MEI, Solidaridad NO se tocan. Antes de pegar al Excel en producción, abre el archivo descargado y revisa los valores.
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setMostrarExportMaster(false)}
                  disabled={procesandoMaster}
                  style={{ background: "transparent", color: "#666", border: "1px solid #888", padding: "8px 16px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Courier New',monospace", opacity: procesandoMaster ? 0.5 : 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={procesarExcelMaster}
                  disabled={procesandoMaster || !archivoMaster}
                  style={{ background: archivoMaster && !procesandoMaster ? "#c8a96e" : "#ddd", color: archivoMaster && !procesandoMaster ? "#1a1a1a" : "#888", border: "none", padding: "8px 20px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: archivoMaster && !procesandoMaster ? "pointer" : "not-allowed", fontFamily: "'Courier New',monospace" }}
                >
                  {procesandoMaster ? "Procesando..." : "✓ Generar y descargar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// PANEL ADMIN: GESTIÓN DE PROYECTOS (v43)
// ═══════════════════════════════════════════════════════════════════════

function PanelProyectos({ usuarioActual, onCerrar }) {
  const [proyectos, setProyectos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]); // [{usuario_id, proyecto_id}]
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [nuevoForm, setNuevoForm] = useState({ nombre: "", productora: "" });
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [editando, setEditando] = useState(null); // {id, nombre, productora, activo}
  const [proyectoAsignar, setProyectoAsignar] = useState(null); // proyecto en edición de usuarios

  const recargar = async () => {
    setCargando(true); setError(null);
    try {
      const [proys, usrs, asigs] = await Promise.all([
        listarProyectos({ adminPin: usuarioActual.pin, esAdmin: true }),
        listarUsuariosAdmin(usuarioActual.pin),
        listarAsignaciones(usuarioActual.pin),
      ]);
      setProyectos(proys);
      setUsuarios(usrs);
      setAsignaciones(asigs);
    } catch (err) { setError(err.message); }
    setCargando(false);
  };

  useEffect(() => { recargar(); }, []);

  const onAdd = async () => {
    if (!nuevoForm.nombre.trim() || !nuevoForm.productora.trim()) {
      alert("Nombre y Productora son obligatorios"); return;
    }
    try {
      await crearProyecto(usuarioActual.pin, nuevoForm.nombre.trim(), nuevoForm.productora.trim());
      setNuevoForm({ nombre: "", productora: "" });
      setMostrarNuevo(false);
      recargar();
    } catch (err) { alert("Error al crear: " + err.message); }
  };

  const onGuardarEdit = async () => {
    try {
      await actualizarProyecto(usuarioActual.pin, editando.id, {
        nombre: editando.nombre.trim(),
        productora: editando.productora.trim(),
        activo: editando.activo,
      });
      setEditando(null);
      recargar();
    } catch (err) { alert("Error al guardar: " + err.message); }
  };

  const onBorrar = async (p) => {
    if (!confirm(`¿Borrar el proyecto "${p.nombre}"?\n\nSe perderán todas las asignaciones. Los perfiles asociados quedarán huérfanos.`)) return;
    try {
      await borrarProyecto(usuarioActual.pin, p.id);
      recargar();
    } catch (err) { alert("Error al borrar: " + err.message); }
  };

  // Asignar/desasignar usuario a proyecto
  const estaAsignado = (usuarioId, proyectoId) =>
    asignaciones.some(a => a.usuario_id === usuarioId && a.proyecto_id === proyectoId);

  const toggleAsignacion = async (usuarioId, proyectoId) => {
    try {
      if (estaAsignado(usuarioId, proyectoId)) {
        await desasignarUsuarioProyecto(usuarioActual.pin, usuarioId, proyectoId);
      } else {
        await asignarUsuarioProyecto(usuarioActual.pin, usuarioId, proyectoId);
      }
      // Recargar solo asignaciones (más rápido)
      const asigs = await listarAsignaciones(usuarioActual.pin);
      setAsignaciones(asigs);
    } catch (err) { alert("Error: " + err.message); }
  };

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(20,20,20,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  };
  const modal = {
    background: "#faf7f2", padding: 20, borderRadius: 6, maxWidth: 850, width: "90%",
    maxHeight: "88vh", overflowY: "auto", color: "#1a1a1a",
    fontFamily: "'Courier New',monospace", border: "1px solid #b8864a",
  };
  const btnGold = {
    background: "#b8864a", color: "#fff", border: "none",
    padding: "6px 12px", borderRadius: 4, cursor: "pointer",
    fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
  };
  const btnGhost = {
    background: "transparent", color: "#b8864a", border: "1px solid #b8864a",
    padding: "6px 12px", borderRadius: 4, cursor: "pointer",
    fontFamily: "'Courier New',monospace", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
  };
  const inp = {
    padding: "6px 8px", border: "1px solid #d0ccc6", borderRadius: 4,
    fontFamily: "'Courier New',monospace", fontSize: 12, background: "#fff",
    color: "#1a1a1a", colorScheme: "light",
  };

  return (
    <div style={overlay} onClick={onCerrar}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid #e0ddd8", paddingBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a1a1a" }}>📁 Gestión de Proyectos</h2>
          <button onClick={onCerrar} style={{ background: "transparent", color: "#888", border: "1px solid #ccc", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Courier New',monospace" }}>Cerrar</button>
        </div>

        {error && <div style={{ background: "#fee", color: "#900", padding: 8, borderRadius: 4, marginBottom: 10, fontSize: 11 }}>Error: {error}</div>}

        {/* Botón nuevo */}
        {!mostrarNuevo && (
          <button onClick={() => setMostrarNuevo(true)} style={{ ...btnGold, marginBottom: 12 }}>+ Nuevo proyecto</button>
        )}

        {/* Formulario nuevo */}
        {mostrarNuevo && (
          <div style={{ background: "#fff", padding: 12, borderRadius: 4, marginBottom: 14, border: "1px solid #e0ddd8" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "center" }}>
              <input placeholder="Nombre del proyecto" value={nuevoForm.nombre} onChange={e => setNuevoForm({...nuevoForm, nombre: e.target.value})} style={inp} />
              <input placeholder="Productora" value={nuevoForm.productora} onChange={e => setNuevoForm({...nuevoForm, productora: e.target.value})} style={inp} />
              <button onClick={onAdd} style={btnGold}>Crear</button>
              <button onClick={() => { setMostrarNuevo(false); setNuevoForm({ nombre: "", productora: "" }); }} style={btnGhost}>Cancelar</button>
            </div>
          </div>
        )}

        {cargando && <div style={{ padding: 20, textAlign: "center", color: "#888" }}>Cargando...</div>}

        {/* Lista de proyectos */}
        {!cargando && proyectos.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>No hay proyectos. Crea el primero.</div>
        )}

        {!cargando && proyectos.map(p => (
          <div key={p.id} style={{ background: "#fff", padding: 12, borderRadius: 4, marginBottom: 8, border: "1px solid #e0ddd8" }}>
            {editando?.id === p.id ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: 8, alignItems: "center" }}>
                <input value={editando.nombre} onChange={e => setEditando({...editando, nombre: e.target.value})} style={inp} />
                <input value={editando.productora} onChange={e => setEditando({...editando, productora: e.target.value})} style={inp} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <input type="checkbox" checked={editando.activo} onChange={e => setEditando({...editando, activo: e.target.checked})} /> Activo
                </label>
                <button onClick={onGuardarEdit} style={btnGold}>Guardar</button>
                <button onClick={() => setEditando(null)} style={btnGhost}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto auto", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: p.activo ? "#1a1a1a" : "#999" }}>
                  {p.nombre} {!p.activo && <span style={{ fontSize: 9, color: "#c00" }}>(inactivo)</span>}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>{p.productora}</div>
                <div style={{ fontSize: 10, color: "#888" }}>
                  {asignaciones.filter(a => a.proyecto_id === p.id).length} usuarios
                </div>
                <button onClick={() => setProyectoAsignar(proyectoAsignar?.id === p.id ? null : p)} style={btnGhost}>👥 Usuarios</button>
                <button onClick={() => setEditando({ id: p.id, nombre: p.nombre, productora: p.productora, activo: p.activo })} style={btnGhost}>Editar</button>
                <button onClick={() => onBorrar(p)} style={{ ...btnGhost, borderColor: "#c00", color: "#c00" }}>🗑</button>
              </div>
            )}

            {/* Sub-panel asignación usuarios */}
            {proyectoAsignar?.id === p.id && (
              <div style={{ marginTop: 12, padding: 10, background: "#f0ede8", borderRadius: 4, border: "1px solid #d0ccc6" }}>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Marca los usuarios que pueden acceder a este proyecto:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                  {usuarios.filter(u => !u.es_admin && u.activo).map(u => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 6px", background: "#fff", borderRadius: 3, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={estaAsignado(u.id, p.id)}
                        onChange={() => toggleAsignacion(u.id, p.id)}
                      />
                      {u.nombre}
                    </label>
                  ))}
                  {usuarios.filter(u => !u.es_admin && u.activo).length === 0 && (
                    <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                      No hay usuarios normales activos. Los admins ven todos los proyectos automáticamente.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// BANNER SUPERIOR (sesión actual)
// ═══════════════════════════════════════════════════════════════════════

function BannerSesion({ usuario, proyectoActivo, onLogout, onAdmin, onLogs, onPuestos, onProyectos, tab, onChangeTab }) {
  const tabBtn = (id, label) => {
    const activa = tab === id;
    return (
      <button
        onClick={() => onChangeTab(id)}
        style={{
          background: activa ? "#c8a96e" : "transparent",
          color: activa ? "#1a1a1a" : "#aaa",
          border: `1px solid ${activa ? "#c8a96e" : "#444"}`,
          padding: "5px 14px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "'Courier New',monospace",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          transition: "all 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  // Botón "Coste Empresa" con control de acceso (solo admin)
  const tabCosteEmpresa = () => {
    const id = "costeEmpresa";
    const activa = tab === id;
    const esAdmin = usuario.es_admin;
    return (
      <button
        onClick={() => {
          if (!esAdmin) {
            alert("Acceso restringido\n\nLa pestaña Coste Empresa solo está disponible para administradores.");
            return;
          }
          onChangeTab(id);
        }}
        title={esAdmin ? "" : "Acceso restringido a admin"}
        style={{
          background: activa ? "#c8a96e" : "transparent",
          color: activa ? "#1a1a1a" : (esAdmin ? "#aaa" : "#666"),
          border: `1px solid ${activa ? "#c8a96e" : (esAdmin ? "#444" : "#333")}`,
          padding: "5px 14px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "'Courier New',monospace",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          transition: "all 0.15s",
          opacity: (esAdmin || activa) ? 1 : 0.6,
        }}
      >
        {!esAdmin && "🔒 "}Coste Empresa
      </button>
    );
  };

  return (
    <div className="no-print" style={{
      background: "#1a1a1a", color: "#f0ede8", padding: "8px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: "0.08em",
      gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 24, height: 24, background: "#c8a96e", color: "#1a1a1a", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>B</span>
        <span style={{ color: "#888", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.18em" }}>Sesión:</span>
        <span style={{ fontWeight: 700, color: "#f0ede8" }}>{usuario.nombre}</span>
        {usuario.es_admin && <span style={{ background: "#c8a96e", color: "#1a1a1a", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em" }}>ADMIN</span>}
        <span style={{ color: "#ffffff", fontSize: 13, letterSpacing: "0.08em", fontWeight: 700, marginLeft: 6 }} title="Versión de la app">v48</span>
      </div>

      {/* Pestañas centrales */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {tabBtn("iruna45", "45H")}
        {tabBtn("tab40", "40H")}
        {tabCosteEmpresa()}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {/* Botón proyectos: TODOS lo ven, muestra el proyecto activo y al pulsar sale al selector */}
        <button
          onClick={onProyectos}
          title="Cambiar de proyecto"
          style={{
            background: "#c8a96e", color: "#1a1a1a", border: "1px solid #c8a96e",
            padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 10,
            fontFamily: "'Courier New',monospace", fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}
        >📁 {proyectoActivo?.nombre || "Proyectos"}</button>
        {usuario.es_admin && (
          <>
            <button onClick={onAdmin} style={{ background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>⚙ Usuarios</button>
            <button onClick={onLogs} style={{ background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>📊 Logs</button>
            <button onClick={onPuestos} style={{ background: "transparent", color: "#c8a96e", border: "1px solid #c8a96e", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>📋 Puestos</button>
          </>
        )}
        <button onClick={onLogout} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cerrar sesión</button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT
// ═══════════════════════════════════════════════════════════════════════

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [comprobando, setComprobando] = useState(true);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const [mostrarLogs, setMostrarLogs] = useState(false);
  const [mostrarPuestos, setMostrarPuestos] = useState(false);
  const [mostrarProyectos, setMostrarProyectos] = useState(false);
  const [proyectoActivo, setProyectoActivo] = useState(null); // v45: proyecto seleccionado
  const [tab, setTab] = useState("iruna45"); // "iruna45" | "tab40"

  // ── Carga inicial: lee sesión, comprueba si ha expirado, entra directo si vale
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(AUTH_KEY);
      if (!guardado) { setComprobando(false); return; }

      const parsed = JSON.parse(guardado);
      const ahora = Date.now();
      const ultima = parsed.ultima_actividad || 0;
      const tiempoSinActividad = ahora - ultima;

      // Si pasaron más de SESION_DURACION_MS sin actividad → caducada
      if (tiempoSinActividad > SESION_DURACION_MS) {
        localStorage.removeItem(AUTH_KEY);
        setComprobando(false);
        return;
      }

      // Sesión válida: entrar DIRECTO sin esperar a Supabase (modo híbrido)
      setUsuario({
        id: parsed.id,
        nombre: parsed.nombre,
        es_admin: parsed.es_admin,
        pin: parsed.pin,
      });
      // Restaurar proyecto activo si lo tenía seleccionado (v45)
      if (parsed.proyecto_activo) {
        setProyectoActivo(parsed.proyecto_activo);
      }
      // Renovar timestamp
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...parsed, ultima_actividad: ahora }));
      setComprobando(false);

      // Revalidar contra Supabase EN SEGUNDO PLANO. Si falla, no hacer nada
      // (el usuario sigue dentro). Solo cerrar si Supabase confirma que el
      // usuario fue borrado o el PIN cambió.
      loginUsuario(parsed.nombre, parsed.pin)
        .then(u => {
          if (!u) {
            // Confirmado: el usuario ya no existe o cambió el PIN
            localStorage.removeItem(AUTH_KEY);
            setUsuario(null);
          }
        })
        .catch(() => { /* error de red: dejar al usuario dentro */ });
    } catch {
      setComprobando(false);
    }
  }, []);

  // ── Detector de actividad: cada interacción renueva el timestamp
  // y un check periódico cierra sesión si pasó SESION_DURACION_MS
  useEffect(() => {
    if (!usuario) return;

    const renovar = () => {
      try {
        const guardado = localStorage.getItem(AUTH_KEY);
        if (!guardado) return;
        const parsed = JSON.parse(guardado);
        parsed.ultima_actividad = Date.now();
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed));
      } catch {}
    };

    // Throttle: como mucho una vez cada 30 segundos
    let ultimoRenovado = Date.now();
    const onActividad = () => {
      const ahora = Date.now();
      if (ahora - ultimoRenovado > 30000) {
        ultimoRenovado = ahora;
        renovar();
      }
    };

    const eventos = ["mousedown", "keydown", "scroll", "touchstart"];
    eventos.forEach(e => window.addEventListener(e, onActividad, { passive: true }));

    // Check periódico de expiración (cada 60s mira si pasaron 30 min sin actividad)
    const timer = setInterval(() => {
      try {
        const guardado = localStorage.getItem(AUTH_KEY);
        if (!guardado) {
          setUsuario(null);
          return;
        }
        const parsed = JSON.parse(guardado);
        const tiempoSinActividad = Date.now() - (parsed.ultima_actividad || 0);
        if (tiempoSinActividad > SESION_DURACION_MS) {
          localStorage.removeItem(AUTH_KEY);
          setUsuario(null);
        }
      } catch {}
    }, 60000);

    return () => {
      eventos.forEach(e => window.removeEventListener(e, onActividad));
      clearInterval(timer);
    };
  }, [usuario]);

  // Wrapper para el setUsuario que recibe PantallaLogin (incluye ultima_actividad)
  const onLoginAcierto = (u) => {
    setUsuario(u);
    // Al hacer login siempre pasamos por el selector de proyecto
    setProyectoActivo(null);
  };

  const cerrarSesion = () => {
    try { localStorage.removeItem(AUTH_KEY); } catch {}
    setUsuario(null);
    setProyectoActivo(null);
  };

  // v45: Seleccionar un proyecto y persistir en localStorage
  const seleccionarProyecto = (p) => {
    setProyectoActivo(p);
    try {
      const guardado = localStorage.getItem(AUTH_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        parsed.proyecto_activo = p;
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed));
      }
    } catch {}
  };

  // v45: Salir del proyecto activo → volver al selector
  const salirDelProyecto = () => {
    setProyectoActivo(null);
    try {
      const guardado = localStorage.getItem(AUTH_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        delete parsed.proyecto_activo;
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed));
      }
    } catch {}
  };

  if (comprobando) return <div style={{ minHeight: "100vh", background: "#1a1a1a" }} />;
  if (!usuario) return <PantallaLogin onAcierto={onLoginAcierto} />;

  // v45: Si hay usuario pero no ha elegido proyecto, mostrar selector
  if (!proyectoActivo) {
    return (
      <>
        <PantallaSelectorProyecto
          usuario={usuario}
          onSeleccionar={seleccionarProyecto}
          onLogout={cerrarSesion}
          onGestionar={() => setMostrarProyectos(true)}
        />
        {mostrarProyectos && usuario.es_admin && (
          <PanelProyectos usuarioActual={usuario} onCerrar={() => setMostrarProyectos(false)} />
        )}
      </>
    );
  }

  return (
    <UsuarioContext.Provider value={usuario}>
      <ProyectoContext.Provider value={proyectoActivo}>
      <div style={{ minHeight: "100vh", background: "#f0ede8" }}>
        <BannerSesion
          usuario={usuario}
          proyectoActivo={proyectoActivo}
          onLogout={cerrarSesion}
          onAdmin={() => setMostrarAdmin(true)}
          onLogs={() => setMostrarLogs(true)}
          onPuestos={() => setMostrarPuestos(true)}
          onProyectos={salirDelProyecto}
          tab={tab}
          onChangeTab={setTab}
        />
        {/* key={tab} fuerza remount al cambiar de pestaña → cada una tiene su propio estado */}
        {tab === "costeEmpresa"
          ? (usuario.es_admin ? <CosteEmpresa key="ce" /> : <App45 key="iruna45" modoTab="iruna45" />)
          : <App45 key={tab} modoTab={tab} />}
        {mostrarAdmin && usuario.es_admin && (
          <PanelAdmin usuarioActual={usuario} onCerrar={() => setMostrarAdmin(false)} />
        )}
        {mostrarLogs && usuario.es_admin && (
          <PanelLogs usuarioActual={usuario} onCerrar={() => setMostrarLogs(false)} />
        )}
        {mostrarPuestos && usuario.es_admin && (
          <PanelPuestos usuarioActual={usuario} onCerrar={() => setMostrarPuestos(false)} />
        )}
        {mostrarProyectos && usuario.es_admin && (
          <PanelProyectos usuarioActual={usuario} onCerrar={() => setMostrarProyectos(false)} />
        )}
      </div>
      </ProyectoContext.Provider>
    </UsuarioContext.Provider>
  );
}
