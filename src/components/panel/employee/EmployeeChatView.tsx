import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, ChatMessage } from '@/types/panel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Send, MessageCircle, ImagePlus, X, Check, CheckCheck, Search, Reply, CornerDownRight, Pencil, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { getStatusColor } from '../StatusSelector';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '../TypingIndicator';
import { EmojiPicker } from '../EmojiPicker';
import { useNotificationSound } from '@/hooks/useNotificationSound';

type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface ProfileWithStatus extends Profile {
  status?: UserStatus;
}

interface ExtendedChatMessage extends ChatMessage {
  image_url?: string | null;
  updated_at?: string | null;
}

export default function EmployeeChatView() {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [profiles, setProfiles] = useState<Record<string, ProfileWithStatus>>({});
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myProfile, setMyProfile] = useState<ProfileWithStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ExtendedChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ExtendedChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get recipient ID (admin who last messaged)
  const recipientId = messages.length > 0 
    ? [...messages].reverse().find(m => m.sender_id !== user?.id)?.sender_id 
    : null;

  const { typingUsers, handleTyping, stopTyping } = useTypingIndicator({
    channelName: recipientId ? `chat-${[user?.id, recipientId].sort().join('-')}` : 'employee-chat',
    userId: user?.id,
    userName: myProfile ? `${myProfile.first_name} ${myProfile.last_name}`.trim() : 'Mitarbeiter',
    recipientId,
  });

  const { playNotificationSound } = useNotificationSound();

  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchProfiles();
      fetchMyProfile();

      const channel = supabase
        .channel('chat-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
          const newMsg = payload.new as ExtendedChatMessage;
          if (!newMsg.is_group_message && (newMsg.sender_id === user.id || newMsg.recipient_id === user.id)) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();
            
            // Play sound for incoming messages (not own messages)
            if (newMsg.sender_id !== user.id) {
              playNotificationSound();
            }
            
            // Auto-mark as read if it's for us
            if (newMsg.recipient_id === user.id && !newMsg.read_at) {
              markMessageAsRead(newMsg.id);
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
          const updatedMsg = payload.new as ExtendedChatMessage;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        })
        .subscribe();

      // Listen for profile status changes
      const profileChannel = supabase
        .channel('chat-profile-updates')
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles'
        }, (payload) => {
          const updated = payload.new as any;
          setProfiles(prev => ({
            ...prev,
            [updated.user_id]: { ...prev[updated.user_id], ...updated, status: updated.status || 'offline' }
          }));
        })
        .subscribe();

      // Mark initial unread messages as read
      markMessagesAsRead();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(profileChannel);
      };
    }
  }, [user]);

  const fetchMyProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setMyProfile({ ...data, status: (data as any).status || 'offline' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .eq('is_group_message', false);
  };

  const fetchMessages = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('is_group_message', false)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data && !error) {
      setMessages(data as ExtendedChatMessage[]);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const profileMap: Record<string, ProfileWithStatus> = {};
      (data as any[]).forEach((p) => {
        profileMap[p.user_id] = { ...p, status: p.status || 'offline' };
      });
      setProfiles(profileMap);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Fehler', description: 'Bild darf maximal 5MB groß sein.', variant: 'destructive' });
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !user) return null;

    const fileExt = selectedImage.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, selectedImage);

    if (error) {
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden.', variant: 'destructive' });
      return null;
    }

    const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    // Find admin to send to
    const lastAdminMessage = [...messages].reverse().find(m => m.sender_id !== user.id);
    const recipientId = lastAdminMessage?.sender_id;

    if (!recipientId) {
      toast({ title: 'Fehler', description: 'Kein Empfänger gefunden.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    let imageUrl: string | null = null;

    if (selectedImage) {
      imageUrl = await uploadImage();
      if (!imageUrl && selectedImage) {
        setUploading(false);
        return;
      }
    }

    // Build message with quote prefix if replying
    let messageContent = newMessage.trim() || '';
    if (replyingTo) {
      const replyToName = profiles[replyingTo.sender_id]
        ? `${profiles[replyingTo.sender_id].first_name} ${profiles[replyingTo.sender_id].last_name}`
        : 'Unbekannt';
      const quotedText = replyingTo.message?.substring(0, 100) || '[Bild]';
      messageContent = `> ${replyToName}: ${quotedText}${replyingTo.message && replyingTo.message.length > 100 ? '...' : ''}\n\n${messageContent}`;
    }

    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      recipient_id: recipientId,
      message: messageContent,
      is_group_message: false,
      image_url: imageUrl
    });

    setUploading(false);
    stopTyping();

    if (error) {
      toast({ title: 'Fehler', description: 'Nachricht konnte nicht gesendet werden.', variant: 'destructive' });
    } else {
      setNewMessage('');
      setReplyingTo(null);
      clearImage();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    
    const { error } = await supabase
      .from('chat_messages')
      .update({ 
        message: editText.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', editingMessage.id)
      .eq('sender_id', user?.id);
    
    if (error) {
      toast({ title: 'Fehler', description: 'Nachricht konnte nicht bearbeitet werden.', variant: 'destructive' });
    } else {
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, message: editText.trim(), updated_at: new Date().toISOString() } : m));
      setEditingMessage(null);
      setEditText('');
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;
    
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', deleteMessageId)
      .eq('sender_id', user?.id);
    
    if (error) {
      toast({ title: 'Fehler', description: 'Nachricht konnte nicht gelöscht werden.', variant: 'destructive' });
    } else {
      setMessages(prev => prev.filter(m => m.id !== deleteMessageId));
      toast({ title: 'Erfolg', description: 'Nachricht gelöscht.' });
    }
    setDeleteMessageId(null);
  };

  const startEditing = (msg: ExtendedChatMessage) => {
    setEditingMessage(msg);
    setEditText(msg.message || '');
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const getProfileAvatar = (userId: string) => {
    const p = profiles[userId];
    if (!p?.avatar_url) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(p.avatar_url);
    return data.publicUrl;
  };

  const getStatus = (userId: string): UserStatus => {
    return profiles[userId]?.status || 'offline';
  };

  // Filter messages based on search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg => 
        msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profiles[msg.sender_id]?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profiles[msg.sender_id]?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // Helper to format date labels
  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Heute';
    if (isYesterday(date)) return 'Gestern';
    return format(date, 'EEEE, d. MMMM yyyy', { locale: de });
  };

  // Check if message is edited
  const isEdited = (msg: ExtendedChatMessage) => {
    return msg.updated_at && msg.updated_at !== msg.created_at;
  };

  // Get chat partner (admin who we're chatting with) - find from messages
  const chatPartnerId = messages.length > 0 
    ? [...messages].reverse().find(m => m.sender_id !== user?.id)?.sender_id 
    : null;
  const chatPartner = chatPartnerId ? profiles[chatPartnerId] : null;
  const chatPartnerName = chatPartner 
    ? `${chatPartner.first_name} ${chatPartner.last_name}`.trim() 
    : null;
  const chatPartnerInitials = chatPartner 
    ? `${chatPartner.first_name?.[0] || ''}${chatPartner.last_name?.[0] || ''}`.toUpperCase()
    : null;

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Card className="shadow-lg h-full flex flex-col">
        <CardHeader className="pb-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {chatPartner ? (
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getProfileAvatar(chatPartnerId!) || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {chatPartnerInitials || 'AD'}
                    </AvatarFallback>
                  </Avatar>
                  <span 
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(getStatus(chatPartnerId!))}`}
                  />
                </div>
              ) : (
                <MessageCircle className="h-5 w-5 text-primary" />
              )}
              <div>
                <h2 className="font-semibold text-lg">
                  {chatPartnerName || 'Nachrichten'}
                </h2>
                {chatPartner && (
                  <p className="text-xs text-muted-foreground">
                    {getStatus(chatPartnerId!) === 'online' ? 'Online' : 
                     getStatus(chatPartnerId!) === 'away' ? 'Abwesend' :
                     getStatus(chatPartnerId!) === 'busy' ? 'Beschäftigt' : 'Offline'}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearching(!isSearching)}
              className={isSearching ? 'bg-muted' : ''}
              title="Nachrichten durchsuchen"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {isSearching && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nachrichten durchsuchen..."
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p>{searchQuery ? 'Keine Nachrichten gefunden.' : 'Noch keine Nachrichten.'}</p>
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isOwn = msg.sender_id === user?.id;
                  const senderProfile = profiles[msg.sender_id];
                  const senderStatus = getStatus(msg.sender_id);
                  const senderName = senderProfile 
                    ? `${senderProfile.first_name} ${senderProfile.last_name}`
                    : 'Unbekannt';
                  
                  // Date separator logic
                  const msgDate = new Date(msg.created_at);
                  const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                  const showDateSeparator = !prevMsg || !isSameDay(msgDate, new Date(prevMsg.created_at));
                  
                  return (
                    <div key={msg.id}>
                      {/* Date separator */}
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <div className="flex-1 h-px bg-border" />
                          <span className="px-4 text-xs font-medium text-muted-foreground bg-background">
                            {formatDateLabel(msgDate)}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <div className="relative shrink-0 self-end">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getProfileAvatar(msg.sender_id) || ''} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {senderProfile?.first_name?.[0]}{senderProfile?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span 
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(senderStatus)}`}
                            title={senderStatus}
                          />
                        </div>
                        <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-medium">
                              {isOwn ? 'Du' : senderName}
                            </span>
                            <div className={`flex items-center gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), 'HH:mm', { locale: de })}
                              </span>
                              {isEdited(msg) && (
                                <span className="text-[10px] text-muted-foreground/70 italic">(bearbeitet)</span>
                              )}
                            </div>
                          </div>
                          <div className="group relative">
                            {editingMessage?.id === msg.id ? (
                              <div className="flex flex-col gap-2 min-w-[280px] bg-background border rounded-xl p-3 shadow-lg">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                  <Pencil className="h-3 w-3" />
                                  <span>Nachricht bearbeiten</span>
                                </div>
                                <Input
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditMessage();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8">
                                    Abbrechen
                                  </Button>
                                  <Button size="sm" onClick={handleEditMessage} className="h-8">
                                    <Check className="h-4 w-4 mr-1" />
                                    Speichern
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`p-3 rounded-2xl ${
                                    isOwn
                                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                                      : 'bg-muted rounded-bl-sm'
                                  }`}
                                >
                                  {/* Quote preview if message starts with > */}
                                  {msg.message?.startsWith('>') && (
                                    <div className={`flex items-start gap-1 mb-2 pb-2 border-b ${isOwn ? 'border-primary-foreground/20' : 'border-border'}`}>
                                      <CornerDownRight className="h-3 w-3 mt-0.5 opacity-60 shrink-0" />
                                      <p className={`text-xs italic opacity-70 line-clamp-2 ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                                        {msg.message.split('\n\n')[0].substring(2)}
                                      </p>
                                    </div>
                                  )}
                                  {msg.image_url && (
                                    <img 
                                      src={msg.image_url} 
                                      alt="Bild" 
                                      className="max-w-full rounded-lg mb-2 max-h-64 object-contain cursor-pointer"
                                      onClick={() => window.open(msg.image_url!, '_blank')}
                                    />
                                  )}
                                  {msg.message && (
                                    <p className="text-sm whitespace-pre-wrap break-words">
                                      {msg.message.startsWith('>') ? msg.message.split('\n\n').slice(1).join('\n\n') : msg.message}
                                    </p>
                                  )}
                                </div>
                              {/* Action buttons */}
                              <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${
                                isOwn ? '-left-20' : '-right-20'
                              }`}>
                                <button
                                  onClick={() => setReplyingTo(msg)}
                                  className="p-1.5 rounded-full bg-background border shadow-sm hover:bg-muted"
                                  title="Antworten"
                                >
                                  <Reply className="h-3.5 w-3.5" />
                                </button>
                                {isOwn && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="p-1.5 rounded-full bg-background border shadow-sm hover:bg-muted"
                                        title="Mehr"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                                      <DropdownMenuItem onClick={() => startEditing(msg)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setDeleteMessageId(msg.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {/* Read receipt for own messages */}
                        {isOwn && (
                          <div className="flex items-center gap-1 mt-1">
                            {msg.read_at ? (
                              <div className="flex items-center gap-0.5 text-primary" title={`Gelesen um ${format(new Date(msg.read_at), 'HH:mm', { locale: de })}`}>
                                <CheckCheck className="h-3.5 w-3.5" />
                                <span className="text-[10px] text-muted-foreground">Gelesen</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5 text-muted-foreground" title="Zugestellt">
                                <Check className="h-3.5 w-3.5" />
                                <span className="text-[10px]">Zugestellt</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>
          </ScrollArea>
          
          {/* Typing indicator */}
          <TypingIndicator typingUsers={typingUsers} />
          
          {messages.length > 0 && (
            <div className="p-4 border-t bg-background">
              {/* Reply preview */}
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-muted/50 border-l-2 border-primary">
                  <Reply className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary">
                      Antwort an {profiles[replyingTo.sender_id]?.first_name || 'Unbekannt'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {replyingTo.message?.substring(0, 50) || '[Bild]'}{replyingTo.message && replyingTo.message.length > 50 ? '...' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded-full hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {imagePreview && (
                <div className="relative inline-block mb-2">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="h-20 w-20 object-cover rounded-lg"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()}
                  title="Bild hochladen"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                <EmojiPicker 
                  onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)}
                  disabled={uploading}
                />
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={handleKeyPress}
                  onBlur={stopTyping}
                  placeholder="Nachricht schreiben..."
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={(!newMessage.trim() && !selectedImage) || uploading} 
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nachricht löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Nachricht wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
