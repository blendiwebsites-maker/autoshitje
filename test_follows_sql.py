import sqlite3
from pathlib import Path
base=Path(__file__).parent
c=sqlite3.connect(':memory:')
c.execute('PRAGMA foreign_keys=ON')
c.executescript((base/'schema-real.sql').read_text())
c.executescript((base/'schema-follows.sql').read_text())
c.executescript((base/'schema-follows.sql').read_text())
for uid,role in [('buyer','privat'),('dealer','autosallon'),('other','privat')]:
 c.execute('INSERT INTO as_users(id,name,email,password_hash,salt,role) VALUES(?,?,?,?,?,?)',(uid,uid,uid+'@example.test','x','x',role))
c.execute("INSERT OR IGNORE INTO as_dealer_follows(user_id,dealer_id) SELECT ?,id FROM as_users WHERE id=? AND role='autosallon' AND id<>?",('buyer','dealer','buyer'))
c.execute("INSERT OR IGNORE INTO as_dealer_follows(user_id,dealer_id) SELECT ?,id FROM as_users WHERE id=? AND role='autosallon' AND id<>?",('buyer','other','buyer'))
assert c.execute('SELECT count(*) FROM as_dealer_follows').fetchone()[0]==1
c.execute("INSERT INTO as_cars(id,user_id,brand,model,year,km,price,city,phone,status) VALUES ('car1','dealer','BMW','320',2019,90000,18000,'Prishtinë','123','active')")
c.execute("INSERT INTO as_cars(id,user_id,brand,model,year,km,price,city,phone,status) VALUES ('car2','dealer','BMW','320',2019,90000,18000,'Prishtinë','123','sold')")
feed=c.execute("SELECT c.id FROM as_cars c JOIN as_dealer_follows f ON f.dealer_id=c.user_id JOIN as_users u ON u.id=c.user_id WHERE f.user_id=? AND c.status='active' ORDER BY c.created_at DESC,c.id DESC LIMIT 60",('buyer',)).fetchall()
assert feed==[('car1',)],feed
c.execute("DELETE FROM as_cars WHERE user_id='dealer'")
c.execute("DELETE FROM as_users WHERE id='dealer'")
assert c.execute('SELECT count(*) FROM as_dealer_follows').fetchone()[0]==0
print('PASS: migration repeatable; dealer-only follows; active-only feed; cascade deletion')
