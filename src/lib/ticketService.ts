import { supabase } from './supabase-client';
import { Db } from '../data/tables';

export interface SupportTicket {
  id: string;
  driver_id: string; // Used as user_id for clients
  driver_name: string; // Used as customer_name
  driver_phone: string; // Used as customer phone
  description: string;
  status: 'open' | 'closed' | 'resolved'; // Usually stored as string
  created_at: string;
  admin_reply?: string;
  responded_at?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'driver' | 'admin'; // 'driver' replaces client
  message: string;
  created_at: string;
}

/**
 * Mappage:
 * - user.id -> driver_id
 * - user.fullName -> driver_name
 * - user.phone -> driver_phone
 */
export async function createTicket(
  userId: string,
  name: string,
  phone: string,
  description: string
): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    // 1. Create the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from(Db.supportTickets)
      .insert({
        driver_id: userId,
        driver_name: name,
        driver_phone: phone,
        description: description,
        status: 'open'
      })
      .select('id')
      .single();

    if (ticketError || !ticket) {
      console.error('Error creating ticket:', ticketError);
      return { success: false, error: 'Impossible de créer le ticket.' };
    }

    // 2. Insert auto-message saying "Je suis X..."
    const autoMessage = `Bonjour, je suis ${name} et mon numéro est ${phone}. Je souhaite de l'aide concernant : ${description}`;
    
    await supabase.from(Db.supportMessages).insert({
      ticket_id: ticket.id,
      sender_type: 'driver',
      message: autoMessage
    });

    return { success: true, ticketId: ticket.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchUserTickets(userId: string): Promise<SupportTicket[]> {
  try {
    const { data, error } = await supabase
      .from(Db.supportTickets)
      .select('*')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }

    return data as SupportTicket[];
  } catch (err) {
    console.error('Failed fetching user tickets:', err);
    return [];
  }
}

export async function fetchTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  try {
    const { data, error } = await supabase
      .from(Db.supportMessages)
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
    return data as SupportMessage[];
  } catch (err) {
    console.error('Failed fetching ticket messages:', err);
    return [];
  }
}

export async function sendTicketMessage(
  ticketId: string,
  message: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from(Db.supportMessages).insert({
      ticket_id: ticketId,
      sender_type: 'driver',
      message
    });

    return !error;
  } catch (err) {
    console.error('Failed to send message:', err);
    return false;
  }
}
