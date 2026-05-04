import React, { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, getDocs, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { LogIn, LogOut, Send, Fuel, History, X, ChevronLeft, ChevronRight, Trash2, Edit2, Check } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: `You are a warm, helpful fuel tracking assistant. 
  
  Your primary goal is to extract fuel record data from the user's message.
  
  JSON STRUCTURE:
  {
    "cost": number | null,
    "volume": number | null,
    "date": "YYYY-MM-DD" | null,
    "isNewEvent": boolean,
    "message": "Your friendly response"
  }

  DATA EXTRACTION RULES:
  1. ONLY provide 'cost' or 'volume' if the user's latest message contains NEW information or is CORRECTING/ADDING to the current event.
  2. If the user is just saying "No", "Thanks", "Okay", or just chatting without providing new fuel data, set 'cost', 'volume', and 'date' to NULL.
  3. If the user provides missing details (like liters) for a previously mentioned cost, set 'cost' to that previous value, 'volume' to the new value, and 'isNewEvent' to FALSE.

  RULES for 'isNewEvent':
  1. Set 'isNewEvent' to TRUE only when the user starts describing a NEW refueling stop that hasn't been recorded in the current session.
  2. Set 'isNewEvent' to FALSE if the user is providing more details (liters, date, price) for the stop you just discussed.
  
  EXAMPLE:
  User: "Spent $50" -> { "cost": 50, "volume": null, "isNewEvent": true, "message": "..." }
  User: "It was 20 liters" -> { "cost": 50, "volume": 20, "isNewEvent": false, "message": "..." }
  User: "No" -> { "cost": null, "volume": null, "isNewEvent": false, "message": "..." }
  User: "Oh, and yesterday I spent $20" -> { "cost": 20, "volume": null, "isNewEvent": true, "message": "..." }
  `,
  generationConfig: {
    responseMimeType: "application/json",
  }
});

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: any;
}

interface FuelRecord {
  id: string;
  cost: number;
  volume?: number;
  timestamp: any;
  rawMessage: string;
}

interface MonthlyData {
  monthYear: string;
  total: number;
  records: FuelRecord[];
  timestamp: Date;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyData[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [lastRecordId, setLastRecordId] = useState<string | null>(null);
  
  // Edit State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState('');
  const [editVolume, setEditVolume] = useState('');

  // Swipe handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/messages`), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      alert("Login failed: " + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const fetchMonthlyHistory = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, `users/${user.uid}/fuel_records`), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const groups: { [key: string]: MonthlyData } = {};
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp) {
          const date = data.timestamp.toDate();
          const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
          
          if (!groups[monthYear]) {
            groups[monthYear] = { 
              monthYear, 
              total: 0, 
              records: [],
              timestamp: new Date(date.getFullYear(), date.getMonth(), 1)
            };
          }
          
          const record: FuelRecord = {
            id: docSnap.id,
            cost: data.cost,
            volume: data.volume,
            timestamp: data.timestamp,
            rawMessage: data.rawMessage
          };
          
          groups[monthYear].total += data.cost;
          groups[monthYear].records.push(record);
        }
      });

      const historyArray = Object.values(groups)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setMonthlyHistory(historyArray);
      if (currentMonthIndex >= historyArray.length) {
        setCurrentMonthIndex(Math.max(0, historyArray.length - 1));
      }
      setShowSummary(true);
    } catch (err: any) {
      alert("Error fetching history: " + err.message);
    }
  };

  const clearChat = async () => {
    if (!user || !window.confirm("Clear all messages? (Your fuel records will be safe)")) return;
    try {
      const q = query(collection(db, `users/${user.uid}/messages`));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      setLastRecordId(null);
      
      await addDoc(collection(db, `users/${user.uid}/messages`), {
        text: "Chat cleared. I'm ready for new records!",
        sender: 'bot',
        timestamp: serverTimestamp()
      });
    } catch (err: any) {
      alert("Clear failed: " + err.message);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!user || !window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/fuel_records`, recordId));
      if (lastRecordId === recordId) setLastRecordId(null);
      await fetchMonthlyHistory();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const startEdit = (record: FuelRecord) => {
    setEditingRecordId(record.id);
    setEditCost(record.cost.toString());
    setEditVolume(record.volume?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingRecordId(null);
    setEditCost('');
    setEditVolume('');
  };

  const saveEdit = async () => {
    if (!user || !editingRecordId) return;
    const cost = parseFloat(editCost);
    const volume = editVolume ? parseFloat(editVolume) : null;
    if (isNaN(cost)) {
      alert("Please enter a valid cost");
      return;
    }
    try {
      await updateDoc(doc(db, `users/${user.uid}/fuel_records`, editingRecordId), { cost, volume });
      setEditingRecordId(null);
      await fetchMonthlyHistory();
    } catch (err: any) {
      alert("Update failed: " + err.message);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (editingRecordId) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (editingRecordId) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) goToNextMonth();
    else if (isRightSwipe) goToPrevMonth();
  };

  const goToNextMonth = () => {
    if (currentMonthIndex < monthlyHistory.length - 1) setCurrentMonthIndex(prev => prev + 1);
  };

  const goToPrevMonth = () => {
    if (currentMonthIndex > 0) setCurrentMonthIndex(prev => prev - 1);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isTyping) return;
    
    const rawInput = input.trim();
    const userMessage = rawInput.replace(/[\u200B-\u200D\uFEFF]/g, '');
    setInput('');

    try {
      if (userMessage.startsWith('/')) {
        const command = userMessage.toLowerCase().split(' ')[0];
        if (command === '/clear') { await clearChat(); return; }
        if (command === '/help') {
          await addDoc(collection(db, `users/${user.uid}/messages`), {
            text: "Available commands:\n/clear - Clear chat history\n/history - Show spending history\n/help - Show this help message",
            sender: 'bot', timestamp: serverTimestamp()
          });
          return;
        }
        if (command === '/summary' || command === '/history') { await fetchMonthlyHistory(); return; }
        await addDoc(collection(db, `users/${user.uid}/messages`), {
          text: `Unknown command: ${command}. Try /clear or /history`, sender: 'bot', timestamp: serverTimestamp()
        });
        return;
      }

      await addDoc(collection(db, `users/${user.uid}/messages`), {
        text: userMessage, sender: 'user', timestamp: serverTimestamp()
      });

      setIsTyping(true);

      let history = messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? ( 'user' as const ) : ( 'model' as const ),
        parts: [{ text: m.text }]
      }));

      const firstUserIndex = history.findIndex(h => h.role === 'user');
      if (firstUserIndex !== -1) history = history.slice(firstUserIndex);
      else history = [];

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();
      
      try {
        const data = JSON.parse(text);

        if (data.cost) {
          const recordTimestamp = data.date ? new Date(data.date) : serverTimestamp();
          
          if (data.isNewEvent || !lastRecordId) {
            // Start a new record
            const docRef = await addDoc(collection(db, `users/${user.uid}/fuel_records`), {
              cost: data.cost,
              volume: data.volume || null,
              rawMessage: userMessage,
              timestamp: recordTimestamp
            });
            setLastRecordId(docRef.id);
          } else {
            // Update the existing record session
            await updateDoc(doc(db, `users/${user.uid}/fuel_records`, lastRecordId), {
              cost: data.cost,
              volume: data.volume || null,
              timestamp: recordTimestamp
            });
          }
        }

        await addDoc(collection(db, `users/${user.uid}/messages`), {
          text: data.message || "Recorded!",
          sender: 'bot',
          timestamp: serverTimestamp()
        });

      } catch (jsonErr) {
        console.error("JSON Error:", jsonErr, text);
        await addDoc(collection(db, `users/${user.uid}/messages`), {
          text: "I had a bit of trouble understanding. Could you try again?",
          sender: 'bot', timestamp: serverTimestamp()
        });
      }

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) return <div className="loading">Loading Fuel Bot...</div>;
  if (error) return <div className="loading">Error: {error}</div>;

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <Fuel size={48} color="#2563eb" />
          <h1>Fuel Tracker</h1>
          <p>Sign in to record your fuel costs</p>
          <button onClick={handleLogin} className="login-btn">
            <LogIn size={20} />
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  const currentMonthData = monthlyHistory[currentMonthIndex];

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <div className="brand">
            <Fuel size={24} />
            <div className="brand-text">
              <h2>Fuel Bot</h2>
              <span className="version-tag">v2.6</span>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={fetchMonthlyHistory} className="header-icon-btn">
              <History size={20} />
            </button>
            <button onClick={handleLogout} className="header-icon-btn">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {showSummary && (
        <div className="summary-overlay" onClick={() => setShowSummary(false)}>
          <div className="summary-modal" onClick={e => e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="summary-header">
              <h3>Spending History</h3>
              <button onClick={() => setShowSummary(false)} className="close-x"><X size={20} /></button>
            </div>
            {monthlyHistory.length > 0 ? (
              <div className="carousel-container">
                <div className="month-nav">
                  <button onClick={goToNextMonth} disabled={currentMonthIndex === monthlyHistory.length - 1} className="nav-arrow"><ChevronLeft size={24} /></button>
                  <div className="month-title">{currentMonthData.monthYear}</div>
                  <button onClick={goToPrevMonth} disabled={currentMonthIndex === 0} className="nav-arrow"><ChevronRight size={24} /></button>
                </div>
                <div className="month-total-display">
                  <div className="total-label">Monthly Total</div>
                  <div className="total-value">${currentMonthData.total.toFixed(2)}</div>
                </div>
                <div className="records-list">
                  {currentMonthData.records.map((record) => (
                    <div key={record.id} className="record-item">
                      {editingRecordId === record.id ? (
                        <div className="edit-form">
                          <div className="edit-inputs">
                            <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)} placeholder="Cost" />
                            <input type="number" value={editVolume} onChange={e => setEditVolume(e.target.value)} placeholder="Liters" />
                          </div>
                          <div className="edit-actions">
                            <button onClick={saveEdit} className="save-btn"><Check size={18}/></button>
                            <button onClick={cancelEdit} className="cancel-btn"><X size={18}/></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="record-info">
                            <div className="record-date">{formatDate(record.timestamp)} @ {formatTime(record.timestamp)}</div>
                            {record.volume && <div className="record-volume">{record.volume} Liters</div>}
                          </div>
                          <div className="record-actions-wrapper">
                            <div className="record-cost">${record.cost.toFixed(2)}</div>
                            <div className="record-buttons">
                              <button onClick={() => startEdit(record)} className="record-btn edit"><Edit2 size={16}/></button>
                              <button onClick={() => handleDeleteRecord(record.id)} className="record-btn delete"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="no-data">No records found yet.</p>
            )}
          </div>
        </div>
      )}

      <main className="chat-area">
        <div className="messages">
          {messages.map((m) => (
            <div key={m.id} className={`message-wrapper ${m.sender}`}>
              <div className="message-bubble">
                {m.text}
                <div className="message-time">{formatTime(m.timestamp)}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="message-wrapper bot">
              <div className="message-bubble typing">
                Bot is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="input-area">
        <form onSubmit={handleSendMessage} className="input-form">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type fuel cost (e.g. 50)" />
          <button type="submit" disabled={!input.trim() || isTyping}><Send size={20} /></button>
        </form>
      </footer>
    </div>
  );
};

export default App;
