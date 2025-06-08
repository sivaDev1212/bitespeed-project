const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();


const app = express();
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false,
  },
});

app.post('/identify', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT * FROM contact WHERE (email = $1 OR phoneNumber = $2)`,
      [email, phoneNumber]
    );

    let mainId;
    let allContacts = [];

    if (result.rows.length > 0) {
        const relatedIds = result.rows
        .map(res => {
          if (res.linkprecedence === 'primary') return res.id;
          if (res.linkprecedence === 'secondary' && res.linkedid) return res.linkedid;
          return null;
        })
        .filter(id => id !== null && id !== undefined && id !== 0);

      if (relatedIds.length === 0) {
        mainId = result.rows[0].id;  
      } else {
        mainId = Math.min(...relatedIds);
      }

      const linkedRes = await client.query(
        `SELECT * FROM contact WHERE (id = $1 OR linkedId = $1)`,
        [mainId]
      );

      allContacts = linkedRes.rows;

      // Check if exact contact exists
      const found = allContacts.find(res => res.email === email && res.phonenumber === phoneNumber);

      if (!found) {
        await client.query(
          `INSERT INTO contact (email, phoneNumber, linkPrecedence, linkedId, createdAt, updatedAt) VALUES ($1, $2, 'secondary', $3, NOW(), NOW())`,
          [email, phoneNumber, mainId]
        );

        const updated = await client.query(
          `SELECT * FROM contact WHERE (id = $1 OR linkedId = $1)`,
          [mainId]
        );

        allContacts = updated.rows;
      }

      const primaries = allContacts.filter(res => res.linkpreference === 'primary');

      if (primaries.length > 1) {
        const oldest = primaries.reduce((prev, curr) => new Date(prev.createdat) < new Date(curr.createdat) ? prev : curr);

        for (let p of primaries) {
          if (p.id !== oldest.id) {
            await client.query(
              `UPDATE contact SET linkPrecedence = 'secondary', linkedId = $1, updatedAt = NOW() WHERE id = $2`,
              [oldest.id, p.id]
            );
          }
        }

        const finalRes = await client.query(
          `SELECT * FROM contact WHERE (id = $1 OR linkedId = $1)`,
          [oldest.id]
        );

        allContacts = finalRes.rows;
        mainId = oldest.id;
      }
    } else {
      const insertRes = await client.query(
        `INSERT INTO contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt) VALUES ($1, $2, 'primary', NOW(), NOW()) RETURNING *`,
        [email, phoneNumber]
      );

      allContacts = [insertRes.rows[0]];
      mainId = insertRes.rows[0].id;
    }

    const primary = allContacts.find(c => c.id === mainId);
console.log('allContacts',allContacts);

    const emails = [...new Set(allContacts.map(c => c.email).filter(Boolean))];
    const phoneNumbers = [...new Set(allContacts.map(c => c.phonenumber).filter(Boolean))];
    const secondaryIds = allContacts.filter(c => c.linkprecedence === 'secondary').map(c => c.id);;
    console.log('secondaryIds',secondaryIds);
    

    await client.query('COMMIT');

    res.status(200).json({
      contact: {
        primaryContactId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds: secondaryIds
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
});

app.get('/fulldata', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM contact`);
    res.status(200).json({ result: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data' });
  } finally {
    client.release();
  }
});

app.listen(3000, () => console.log('Server is running on port 3000'));
