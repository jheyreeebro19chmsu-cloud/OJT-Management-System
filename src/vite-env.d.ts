/// <reference types="vite/client" />

declare module 'phil-reg-prov-mun-brgy' {
  const content: any;
  export default content;
  export const regions: any[];
  export const provinces: any[];
  export const city_mun: any[];
  export const barangays: any[];
  export function getProvincesByRegion(region_code: string): any[];
  export function getCityMunByProvince(province_code: string): any[];
  export function getBarangayByMun(mun_code: string): any[];
}
