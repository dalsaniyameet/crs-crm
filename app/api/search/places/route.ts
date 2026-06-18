import { NextRequest, NextResponse } from "next/server";

const LOCALITIES = [
  // Ahmedabad West
  "Prahlad Nagar", "Satellite", "Bopal", "South Bopal", "Ambli", "Shilaj", "Thaltej",
  "Bodakdev", "Vastrapur", "Navrangpura", "Paldi", "Ambawadi", "Polytechnic",
  "Judges Bungalow Road", "Drive-In Road", "CG Road", "Ashram Road",
  "SG Highway", "Sindhu Bhavan Road", "Anandnagar", "Jodhpur", "Vejalpur",
  "Sarkhej", "Shela", "Ghuma", "Makarba", "Iscon", "Iscon Ambli Road",
  "100 Feet Road Satellite", "Prahladnagar Garden", "Nehrunagar",
  // Ahmedabad East
  "Maninagar", "Nikol", "Naroda", "Odhav", "Vatva", "Narol", "Bapunagar",
  "Gomtipur", "Shahibaug", "Ghatlodia", "Sola", "Naranpura", "Ellis Bridge",
  "Memnagar", "Gurukul", "Science City Road",
  // Ahmedabad North
  "Gota", "Chandkheda", "Motera", "Ranip", "Sabarmati", "New Ranip",
  "Tragad", "Manipur", "Zundal", "Khoraj", "Adalaj", "Vavol", "Uvarsad",
  // Commercial Hubs
  "GIFT City", "SP Ring Road", "GIDC Vatva", "GIDC Naroda", "GIDC Odhav",
  "Rakhial", "Kathwada", "Bavla Road",
  // Gandhinagar
  "Gandhinagar Sector 1", "Gandhinagar Sector 7", "Gandhinagar Sector 11",
  "Gandhinagar Sector 16", "Gandhinagar Sector 21", "Gandhinagar Sector 23",
  "Infocity Gandhinagar", "Indroda",
  // Nearby
  "Sanand", "Bavla", "Dholka", "Dhandhuka", "Dehgam",
  // Popular landmarks
  "Prahladnagar Trade Centre", "Alpha One Mall Area", "Achlaj",
  "Shyamal", "Mansi Circle", "Nehru Nagar", "Rajpath Club Road",
  "IIM Ahmedabad Road", "CEPT University Area", "Gujarat University",
  "Law Garden", "Swaminarayan Temple Road", "Akhbarnagar",
  "New CG Road", "New SG Road", "Hebatpur", "Sargasan",
  "Jagatpur", "Koba", "Kudasan", "Pethapur",
  // User provided list
  "S G Highway", "Dholera", "Pipali Highway", "Noblenagar",
  "Vaishno Devi", "Vastral", "S P Ring Road", "Vasna",
  "Chandlodia", "Science City", "Ghodasar", "Juhapura",
  "Jivrajpark", "Nava Wadaj", "Gokuldham", "Ashram Road",
  "Isanpur", "Thaltej Road", "Changodar", "Kankaria",
  "New Maninagar", "Saraspur", "Amraiwadi", "Palodia",
  "Sanand - Nalsarovar Road", "Ramdev Nagar", "Nirnay Nagar",
  "Sanathal", "Sughad", "Hathijan", "Chanakyapuri", "Shah E Alam Roja",
  "Nava Naroda", "Khokhra", "Saijpur Bogha", "Godhavi",
  "Mahadev Nagar", "Racharda", "Rakanpur", "Nasmed",
  "Jashoda Nagar", "Lambha", "Koteshwar", "Bagodara",
  "Lapkaman", "Kubernagar", "Sola Road", "Ognaj",
  "Bhadaj", "Shantipura", "Hansol", "Naroda Road",
  "Narol Road", "Moraiya", "Behrampura", "Hatkeshwar",
  "Kalupur", "Meghani Nagar", "Barejadi", "Kheda",
  "Khodiar Nagar", "Bhat", "Asarwa", "Chharodi", "Khanpur",
  "Naroda GIDC", "Raipur", "Shahpur", "Thakkarbapa Nagar",
  "Usmanpura", "132 Feet Ring Road", "Sanand-Viramgam Road",
  "Ahmedabad-Rajkot Highway", "Aslali", "Ayojan Nagar",
  "Bhadra", "Dani Limbada", "Dariapur", "Dudheshwar",
  "Girdhar Nagar", "Gulbai Tekra", "Jamalpur", "Juna Wadaj",
  "Kalapinagar", "Keshav Nagar", "Khadia", "Khamasa",
  "Madhupura", "Navjivan", "Raikhad", "Sadar Bazar",
  "Vatva GIDC", "Viramgam", "Kali", "Santej", "Nandej",
  "Raska", "Laxmanpura", "Bavla Nalsarovar Road", "Unali",
  "Mandal", "D Colony", "Sardar Colony", "Kotarpur",
  "Mirzapur", "Narayan Nagar", "Kolat", "Purshottam Nagar",
  "Gita Mandir", "Sachana", "Vinzol", "Geratpur",
  "Sarangpur", "Acher", "Devdholera", "Lilapur",
  "Mahemdabad", "Vishala",
  // User provided list 2
  "Racharda", "Palodia", "Shyamal", "Viramgam",
  "Vasna", "Vastrapur", "Vejalpur", "Manipur",
  "Godhavi", "Kolat", "Sachana", "South Bopal",
  "Narayan Nagar", "Sardar Colony", "Bagodara",
  "Sanand - Nalsarovar Road", "Sanand-Viramgam Road",
  "Shela", "Satellite", "C G Road", "Ghuma",
  "Gulbai Tekra", "Gurukul", "Bopal", "Bodakdev",
  "Ambli", "Ashram Road", "Ayojan Nagar", "Jivrajpark",
  "Jodhpur", "Prahlad Nagar", "Ramdev Nagar", "Sanand",
  "Paldi", "Navjivan", "Juhapura", "Makarba",
  "Naranpura", "Ambawadi", "Navrangpura", "S G Highway",
].sort();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() || "";
  if (q.length < 1) return NextResponse.json([]);

  const clean = q.replace(/ahmedabad/gi, "").trim();

  const results = LOCALITIES.filter(loc =>
    loc.toLowerCase().includes(clean)
  ).slice(0, 8);

  return NextResponse.json(results);
}
