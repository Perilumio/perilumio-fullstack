export function AdminImportHistory({ logs = [] }: { logs?: any[] }){
  return <div className="card stack"><span className="pill">Import-Historie</span><h2>Letzte Importe</h2><div className="stack">{logs.length ? logs.map((item:any) => <div key={item.id} className="card"><strong>{item.source}</strong><p className="muted">{String(item.created_at || '').replace('T',' ').slice(0,16)} · {item.status} · {item.row_count} Datensätze</p></div>) : <p className="muted">Noch keine Import-Logs vorhanden.</p>}</div></div>;
}
