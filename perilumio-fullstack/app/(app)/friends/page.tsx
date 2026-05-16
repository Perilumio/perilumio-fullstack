import { AppShell, Lumio } from '@/components/AppShell';
const friends = [
  { name:'Corina', xp:"1'850", bp:'135' },
  { name:'Anina', xp:"1'740", bp:'142' },
  { name:'Katrin', xp:"1'630", bp:'165' },
  { name:'Daniel', xp:"1'590", bp:'169' },
  { name:'Roland', xp:"1'550", bp:'178' }
];
export default function FriendsPage(){ return <AppShell><section className="stack"><div className="card hero"><div><span className="pill">Freunde</span><h1>Dein Lernumfeld</h1><p className="muted">Freunde-Ansicht mit XP- und Battlepunkte-Vergleich.</p></div><Lumio /></div><div className="card stack"><button className="btn btn-primary">+ Freunde hinzufügen</button>{friends.map((friend,index)=><div key={friend.name} className="card"><strong>#{index + 1} {friend.name}</strong><div className="muted">XP {friend.xp} · BP {friend.bp}</div></div>)}</div></section></AppShell>; }