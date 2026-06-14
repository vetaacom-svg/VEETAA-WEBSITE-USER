import { supabase } from './supabase-client';
import { Db } from '../data/tables';

export interface Rib {
  id: number;
  rib: string;
  label: string;
  full_name?: string;
}

export interface SupportInfo {
  phone: string;
  email: string;
}

export interface SocialLink {
  id: number;
  platform: string;
  url: string;
  icon_name?: string;
  is_active?: boolean;
  display_order?: number;
}

export type RibsResult = { data: Rib[]; error: null } | { data: []; error: string };

export const getRibs = async (): Promise<RibsResult> => {
  const { data, error } = await supabase.from(Db.ribs).select('*');
  if (error) {
    console.error('Error fetching RIBs:', error.message);
    return { data: [], error: error.message };
  }
  return { data: Array.isArray(data) ? data : [], error: null };
};

export const getSupportInfo = async (): Promise<SupportInfo | null> => {
  const { data, error } = await supabase.from(Db.supportInfo).select('phone, email').single();
  if (error) return null;
  return data as SupportInfo;
};

export const getSocialLinks = async (): Promise<SocialLink[]> => {
  const { data, error } = await supabase
    .from(Db.socialLinks)
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) {
    console.error('Error fetching social links:', error.message);
    return [];
  }
  return data as SocialLink[];
};
