  // Additional user functions for simple auth
  async findUserByEmail(email) {
    if (this.isFirebase) {
      const usersSnapshot = await this.db.collection('users').where('email', '==', email).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async findUserById(id) {
    if (this.isFirebase) {
      const userDoc = await this.db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  // Update createUser to handle simple auth
  async createUserSimple(userData) {
    if (this.isFirebase) {
      const userRef = this.db.collection('users').doc();
      await userRef.set({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: userRef.id, ...userData };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [userData.name, userData.email, userData.password],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...userData });
          }
        );
      });
    }
  }
  // Additional user functions for simple auth
  async findUserByEmail(email) {
    if (this.isFirebase) {
      const usersSnapshot = await this.db.collection('users').where('email', '==', email).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async findUserById(id) {
    if (this.isFirebase) {
      const userDoc = await this.db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  // Update createUser to handle simple auth
  async createUserSimple(userData) {
    if (this.isFirebase) {
      const userRef = this.db.collection('users').doc();
      await userRef.set({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: userRef.id, ...userData };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [userData.name, userData.email, userData.password],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...userData });
          }
        );
      });
    }
  }
  // Additional user functions for simple auth
  async findUserByEmail(email) {
    if (this.isFirebase) {
      const usersSnapshot = await this.db.collection('users').where('email', '==', email).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }

  async findUserById(id) {
    if (this.isFirebase) {
      const userDoc = await this.db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return { id: userDoc.id, ...userData };
      }
      return null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT * FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    }
  }
