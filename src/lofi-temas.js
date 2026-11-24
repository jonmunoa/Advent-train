/* Villancicos para la música de fondo: melodía y acordes (todos de dominio público) y el arreglo lofi de cada uno, sin audio ni DOM.
   Una nota es NOTA[:pulsos] (un pulso si no se dice) y R es silencio; «|» separa compases. Los acordes van por compás (dos con coma).
   `seis` = compás de 6/8 escrito de tres en tres corcheas.
   El pulso lo marca el tren: P es lo que tarda la locomotora en dar media vuelta de rueda, y es la corchea de todas las canciones. */
const WB = .78, VT = 6.2;
export const P = Math.PI * WB / VT;

export const TEMAS = [
  {id: 'noche', t: 'Noche de paz', o: 'F. X. Gruber, 1818', bpb: 3, seis: 1,
    m: 'G4:1.5 A4:.5 G4 | E4:3 | G4:1.5 A4:.5 G4 | E4:3 | D5:2 D5 | B4:3 | C5:2 C5 | G4:3 | A4:2 A4 | C5:1.5 B4:.5 A4 | G4:1.5 A4:.5 G4 | E4:3 | A4:2 A4 | C5:1.5 B4:.5 A4 | G4:1.5 A4:.5 G4 | E4:3 | D5:2 D5 | F5:1.5 D5:.5 B4 | C5:3 | E5:3 | C5:1.5 G4:.5 E4 | G4:1.5 F4:.5 D4 | C4:3 | C4:3',
    c: 'C | C | C | C | G7 | G7 | C | C | F | F | C | C | F | F | C | C | G7 | G7 | C | C | C | G7 | C | C'},
  {id: 'jingle', t: 'Jingle Bells', o: 'J. Pierpont, 1857', bpb: 4,
    m: 'D4 B4 A4 G4 | D4:3 D4:.5 D4:.5 | D4 B4 A4 G4 | E4:4 | E4 C5 B4 A4 | F#4:4 | D5 D5 C5 A4 | B4:4 | D4 B4 A4 G4 | D4:4 | D4 B4 A4 G4 | E4:3 E4 | E4 C5 B4 A4 | D5 D5 D5 D5 | E5 D5 C5 A4 | G4:2 D5:2 | B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:.5 | B4:4 | C5 C5 C5:1.5 C5:.5 | C5 B4 B4 B4:.5 B4:.5 | B4 A4 A4 B4 | A4:2 D5:2 | B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:.5 | B4:4 | C5 C5 C5:1.5 C5:.5 | C5 B4 B4 B4:.5 B4:.5 | D5 D5 C5 A4 | G4:4',
    c: 'G | G | G | C | Am | D7 | D7 | G | G | G | G | C | Am | D7 | D7 | G | G | G | G | G | C | G | A7 | D7 | G | G | G | G | C | G | D7 | G'},
  {id: 'deck', t: 'Deck the Halls', o: 'tradicional galesa', bpb: 4,
    m: 'G4:1.5 F4:.5 E4 D4 | C4 D4 E4 C4 | D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5 | C4 B3 C4:2 | G4:1.5 F4:.5 E4 D4 | C4 D4 E4 C4 | D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5 | C4 B3 C4:2 | D4:1.5 E4:.5 F4 D4 | E4:1.5 F4:.5 G4 D4 | E4:.5 F#4:.5 G4 A4:.5 B4:.5 C5 | B4 A4 G4:2 | G4:1.5 F4:.5 E4 D4 | C4 D4 E4 C4 | A4:.5 A4:.5 A4:.5 A4:.5 G4:1.5 F4:.5 | E4 D4 C4:2',
    c: 'C | C | G7,C | G7,C | C | C | G7,C | G7,C | G7 | C | C,D7 | D7,G | C | C | F,C | G7,C'},
  {id: 'wish', t: 'We Wish You a Merry Christmas', o: 'tradicional inglesa', bpb: 3,
    m: 'R:2 G4 | C5 C5:.5 D5:.5 C5:.5 B4:.5 | A4 A4 A4 | D5 D5:.5 E5:.5 D5:.5 C5:.5 | B4 G4 G4 | E5 E5:.5 F5:.5 E5:.5 D5:.5 | C5 A4 G4:.5 G4:.5 | A4 D5 B4 | C5:2 G4 | C5 C5 C5 | B4:2 B4 | C5 B4 A4 | G4:2 D5 | E5 D5:.5 D5:.5 C5:.5 C5:.5 | G5 G4 G4:.5 G4:.5 | A4 D5 B4 | C5:3',
    c: 'C | C | F | D7 | G | E7 | Am | G7 | C | C | G | D7 | G | C | C | G7 | C'},
  {id: 'godrest', t: 'God Rest Ye Merry, Gentlemen', o: 'tradicional inglesa', bpb: 4,
    m: 'R:3 E4 | E4 B4 B4 A4 | G4 F#4 E4 D4 | E4 F#4 G4 A4 | B4:3 E4 | E4 B4 B4 A4 | G4 F#4 E4 D4 | E4 F#4 G4 A4 | B4:3 B4 | C5 A4 B4 C5 | D5 E5 B4 A4 | G4 E4 F#4 G4 | A4:2 G4 A4 | B4:2 C5 B4 | B4 A4 G4 F#4 | E4:2 G4:.5 F#4:.5 E4 | A4:2 G4 A4 | B4 C5 D5 E5 | B4 A4 G4 F#4 | E4:4',
    c: 'Em | Em | C | Am | B7 | Em | C | Am | B7 | Am | G | Em | D | G | Am,B7 | Em | D | G | Am,B7 | Em'},
  {id: 'green', t: 'Greensleeves', o: 'tradicional inglesa, s. XVI', bpb: 3, seis: 1,
    m: 'R:2 A4 | C5:2 D5 | E5:1.5 F#5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 | C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:2 A4 | C5:2 D5 | E5:1.5 F#5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 | C5:1.5 B4:.5 A4 | G#4:1.5 F#4:.5 G#4 | A4:3 | A4:3 | G5:3 | G5:1.5 F#5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 | C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:3 | G5:3 | G5:1.5 F#5:.5 E5 | D5:2 B4 | G4:1.5 A4:.5 B4 | C5:1.5 B4:.5 A4 | G#4:1.5 F#4:.5 G#4 | A4:3 | A4:3',
    c: 'Am | Am | Am | G | G | F | F | E7 | E7 | Am | Am | G | G | F | E7 | Am | Am | C | C | G | G | F | F | E7 | E7 | C | C | G | G | F | E7 | Am | Am'},
  {id: 'reyes', t: 'Los tres Reyes (We Three Kings)', o: 'J. H. Hopkins, 1857', bpb: 3, seis: 1,
    m: 'B4:2 A4 | G4:2 E4 | F#4 G4 F#4 | E4:3 | B4:2 A4 | G4:2 E4 | F#4 G4 F#4 | E4:3 | G4:2 G4 | A4:2 A4 | B4:2 B4 | D5 C5 B4 | A4 B4 A4 | G4:2 F#4 | E4:3 | F#4:3 | G4:2 G4 | G4:2 D4 | G4:2 E4 | G4:3 | G4:2 G4 | G4:2 D4 | G4:2 E4 | G4:3 | G4:2 G4 | A4:2 B4 | C5:2 B4 | A4:2 B4 | G4:2 G4 | G4:2 D4 | G4:2 E4 | G4:3',
    c: 'Em | Em | B7 | Em | Em | Em | B7 | Em | G | D | G | G | Am | Em | Em | D7 | G | G | C | G | G | G | C | G | G | D | C | D7 | G | G | C | G'},
  {id: 'adeste', t: 'Adeste, fideles', o: 'J. F. Wade, s. XVIII', bpb: 4,
    m: 'R:3 G4 | G4:2 D4 G4 | A4:2 D4:2 | B4 A4 B4 C5 | B4:2 A4 G4 | G4:2 F#4 E4 | F#4 G4 A4 B4 | F#4:2 E4:1.5 D4:.5 | D4:3 R | D5:2 C5 B4 | C5:2 B4:2 | A4 B4 G4 A4 | F#4:1.5 E4:.5 D4 G4 | G4 F#4 G4 A4 | G4:2 D4 B4 | B4 A4 B4 C5 | B4:2 A4 B4 | C5 B4 A4 G4 | F#4:2 G4 C5 | B4:2 A4:1.5 G4:.5 | G4:4',
    c: 'G | G | D | G | G | Em | D | D,A7 | D | G | Am,G | Am | D | G | G | G | G,D | Am | D7 | G,D7 | G'},
  {id: 'noel', t: 'La primera Navidad (The First Noel)', o: 'tradicional inglesa', bpb: 3,
    m: 'R:2 F#4:.5 E4:.5 | D4:1.5 E4:.5 F#4:.5 G4:.5 | A4:2 B4:.5 C#5:.5 | D5 C#5 B4 | A4:2 B4:.5 C#5:.5 | D5 C#5 B4 | A4 B4 C#5 | D5 A4 G4 | F#4:2 F#4:.5 E4:.5 | D4:1.5 E4:.5 F#4:.5 G4:.5 | A4:2 B4:.5 C#5:.5 | D5 C#5 B4 | A4:2 B4:.5 C#5:.5 | D5 C#5 B4 | A4 B4 C#5 | D5 A4 G4 | F#4:2 F#4:.5 E4:.5 | D4:1.5 E4:.5 F#4:.5 G4:.5 | A4:2 D5:.5 C#5:.5 | B4:2 B4 | A4:3 | D5 C#5 B4 | A4 B4 C#5 | D5 A4 G4 | F#4:3',
    c: 'D | D | D | G | D | Bm | A7 | D | D | D | D | G | D | Bm | A7 | D | D | D | D | G | D | Bm | A7 | D | D'},
  {id: 'joy', t: 'Joy to the World', o: 'L. Mason, 1848', bpb: 4,
    m: 'D5:2 C#5:1.5 B4:.5 | A4:3 G4 | F#4:2 E4:2 | D4:3 A4 | B4:3 B4 | C#5:3 C#5 | D5:3 D5 | D5 C#5 B4 A4 | A4:1.5 G4:.5 F#4 D5 | D5 C#5 B4 A4 | A4:1.5 G4:.5 F#4 F#4 | F#4 F#4 F#4 F#4:.5 G4:.5 | A4:3 G4:.5 F#4:.5 | E4 E4 E4 E4:.5 F#4:.5 | G4:3 F#4:.5 E4:.5 | D4 D5:2 B4 | A4:1.5 G4:.5 F#4 G4 | F#4:2 E4:2 | D4:4',
    c: 'D | D | D,A7 | D | G | A7 | D | D | D | D | D | D | D | A7 | A7 | D,G | D | D,A7 | D'},
  {id: 'hark', t: 'Hark! The Herald Angels Sing', o: 'F. Mendelssohn, 1840', bpb: 4,
    m: 'C4 F4 F4:1.5 E4:.5 | F4 A4 A4 G4 | C5 C5 C5:1.5 Bb4:.5 | A4 G4 A4:2 | C4 F4 F4:1.5 E4:.5 | F4 A4 A4 G4 | C5 G4 G4:1.5 E4:.5 | E4 D4 C4:2 | C5 C5 C5 F4 | Bb4 A4 A4 G4 | C5 C5 C5 F4 | Bb4 A4 A4 G4 | D5 D5 D5 C5 | Bb4 A4 Bb4:2 | G4 A4:.5 Bb4:.5 C5:1.5 F4:.5 | F4 G4 A4:2 | D5:1.5 D5:.5 D5 C5 | Bb4 A4 Bb4:2 | G4 A4:.5 Bb4:.5 C5:1.5 F4:.5 | F4 G4 F4:2',
    c: 'F | F,C | F | C,F | F | F | C | G7,C | F | Bb,C7 | F | Bb,C7 | Bb | D7,Gm | C7,F | C7,F | Bb | D7,Gm | C7,F | C7,F'},
  {id: 'abeto', t: 'El abeto (O Tannenbaum)', o: 'tradicional alemana', bpb: 3,
    m: 'R:2 C4 | F4:.75 F4:.25 F4:1.5 G4:.5 | A4:.75 A4:.25 A4:1.5 A4:.5 | G4:.5 A4:.5 Bb4 E4 | G4 F4 C4 | F4:.75 F4:.25 F4:1.5 G4:.5 | A4:.75 A4:.25 A4:1.5 A4:.5 | G4:.5 A4:.5 Bb4 E4 | G4 F4 R:.5 C5:.5 | C5:.5 A4:.5 D5:1.5 C5:.5 | C5:.5 Bb4:.5 Bb4:1.5 Bb4:.5 | Bb4:.5 G4:.5 C5:1.5 Bb4:.5 | Bb4:.5 A4:.5 A4 C4 | F4:.75 F4:.25 F4:1.5 G4:.5 | A4:.75 A4:.25 A4:1.5 A4:.5 | G4:.5 A4:.5 Bb4 E4 | G4 F4:2',
    c: 'F | F | F | Gm | C7 | F | F | Gm | C7 | F | C7 | C7 | F | F | F | Gm | F'},
  {id: 'pesebre', t: 'En el pesebre (Away in a Manger)', o: 'J. R. Murray, 1887', bpb: 3,
    m: 'R:2 C5 | C5:1.5 Bb4:.5 A4 | A4:1.5 G4:.5 F4 | F4 E4 D4 | C4:2 C4 | C4:1.5 D4:.5 C4 | C4 G4 E4 | D4 C4 F4 | A4:2 C5 | C5:1.5 Bb4:.5 A4 | A4:1.5 G4:.5 F4 | F4 E4 D4 | C4:2 C4 | Bb4:1.5 A4:.5 G4 | A4:1.5 G4:.5 F4 | G4 D4 E4 | F4:3',
    c: 'F | F | F | Bb | F | C7 | C7 | F | F | F | F | Bb | F | Gm | F | C7 | F'},
  {id: 'wences', t: 'Good King Wenceslas', o: 'tradicional finlandesa, s. XIII', bpb: 4,
    m: 'G4 G4 G4 A4 | G4 G4 D4:2 | E4 D4 E4 F#4 | G4:2 G4:2 | G4 G4 G4 A4 | G4 G4 D4:2 | E4 D4 E4 F#4 | G4:2 G4:2 | D5 C5 B4 A4 | B4 A4 G4:2 | E4 D4 E4 F#4 | G4:2 G4:2 | D4 D4 E4 F#4 | G4 G4 A4:2 | D5 C5 B4 A4 | G4:2 C5:2 | G4:4',
    c: 'G | G | C,D7 | G | G | G | C,D7 | G | G | Em | C,D7 | G | D7 | Em,D | G,D7 | G,C | G'},
  {id: 'campanas', t: 'Shchedryk, el villancico de las campanas', o: 'tradicional ucraniana', bpb: 3,
    m: 'Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | D5 C5:.5 D5:.5 Bb4 | D5 C5:.5 D5:.5 Bb4 | D5 C5:.5 D5:.5 Bb4 | D5 C5:.5 D5:.5 Bb4 | G5 F5:.5 G5:.5 D5 | G5 F5:.5 G5:.5 D5 | G5 F5:.5 G5:.5 D5 | G5 F5:.5 G5:.5 D5 | D5:2 C5 | Bb4:2 A4 | G4:2 F#4 | G4:3 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | Bb4 A4:.5 Bb4:.5 G4 | G4:3',
    c: 'Gm | Gm | Eb | Eb | Cm | Cm | Gm | Gm | Gm | F | Eb | Bb | Gm | F | Eb | Bb | Bb | Cm | D7 | Gm | Gm | Eb | Cm | Gm'},
  {id: 'campana', t: 'Campana sobre campana', o: 'tradicional andaluza', bpb: 4,
    m: 'G4 G4:.5 G4:.5 G4 F#4:.5 G4:.5 | A4:1.5 F#4:.5 D4:2 | A4 A4:.5 B4:.5 C5 B4:.5 A4:.5 | B4:1.5 A4:.5 G4:2 | G4 G4:.5 G4:.5 G4 F#4:.5 G4:.5 | A4:1.5 F#4:.5 D4:2 | A4 A4:.5 B4:.5 C5 B4:.5 A4:.5 | G4 R:.5 B4:.5 D5 R:.5 D5:.5 | E5:.5 D5:.5 C5:.5 E5:.5 D5 R:.5 D5:.5 | E5:.5 D5:.5 E5:.5 F#5:.5 G5:.5 D5:.5 B4:.5 E5:.5 | D5:.5 C5:.5 B4:.5 A4:.5 G4 R | B4:1.5 C5:.5 B4:.5 A4:.5 G4 | D5:1.5 E5:.5 D5:.5 C5:.5 B4 | D5:1.5 D5:.5 C#5:1.5 A4:.5 | D5:1.5 C5:.5 B4:.5 A4:.5 G4 | B4:1.5 C5:.5 B4:.5 A4:.5 G4 | D5:1.5 E5:.5 D5:.5 C5:.5 B4 | D5:1.5 D5:.5 C#5:1.5 A4:.5 | D5:1.5 C5:.5 B4:.5 A4:.5 G4:.5 B4:.5 | D5 R:.5 D5:.5 E5:.5 D5:.5 C5:.5 E5:.5 | D5 R:.5 D5:.5 E5:.5 D5:.5 E5:.5 F#5:.5 | G5:.5 D5:.5 B4:.5 E5:.5 D5:.5 C5:.5 B4:.5 A4:.5 | G4:4',
    c: 'G | D | D7 | G | G | D | D7 | G | C,G | C,G | D7,G | G | G | D,A7 | D7,G | G | G | D,A7 | D7,G | G,C | G,C | G,D7 | G'},
  {id: 'fum', t: 'Fum, fum, fum', o: 'tradicional catalana', bpb: 4,
    m: 'A4:.75 G#4:.25 A4:.5 C5:.5 B4:.5 A4:.5 G#4:.5 E4:.5 | A4 G#4 A4:2 | A4:.75 G#4:.25 A4:.5 C5:.5 B4:.5 A4:.5 G#4:.5 E4:.5 | A4 G#4 A4:1.5 B4:.25 B4:.25 | C5:.5 C5:.5 B4:.5 B4:.5 C5:.5 G4:.5 G4:.5 G4:.5 | C5:.5 C5:.5 B4:.5 B4:.5 C5:1.5 B4:.25 C5:.25 | D5:.75 C5:.25 B4:.5 A4:.5 G#4:.5 E4:.5 A4:.5 G#4:.5 | A4:.5 C5:.5 B4:.5 A4:.5 G#4 E4 | A4 G#4 A4:2',
    c: 'Am,E7 | Am | Am,E7 | Am | G,C | G,C | Dm,E7 | Am,E7 | Am'},
  {id: 'angeles', t: 'Gloria (Angels We Have Heard on High)', o: 'tradicional francesa', bpb: 4,
    m: 'A4 A4 A4 C5 | C5:1.5 Bb4:.5 A4:2 | A4 G4 A4 C5 | A4:1.5 G4:.5 F4:2 | A4 A4 A4 C5 | C5:1.5 Bb4:.5 A4:2 | A4 G4 A4 C5 | A4:1.5 G4:.5 F4:2 | C5:2 D5:.5 C5:.5 Bb4:.5 A4:.5 | Bb4:2 C5:.5 Bb4:.5 A4:.5 G4:.5 | A4:2 Bb4:.5 A4:.5 G4:.5 F4:.5 | G4:1.5 G4:.5 C4:2 | F4 G4 A4 Bb4 | A4:2 G4:2 | C5:2 D5:.5 C5:.5 Bb4:.5 A4:.5 | Bb4:2 C5:.5 Bb4:.5 A4:.5 G4:.5 | A4:2 Bb4:.5 A4:.5 G4:.5 F4:.5 | G4:1.5 G4:.5 C4:2 | F4 G4 A4 Bb4 | A4:2 G4:2 | F4:4',
    c: 'F | C,F | F | C,F | F | C,F | F | C,F | F,D7 | Gm,C7 | F,Dm | C | F,Bb | F,C7 | F,D7 | Gm,C7 | F,Dm | C | F,Bb | F,C7 | F'},
  {id: 'medianoche', t: 'It Came Upon the Midnight Clear', o: 'R. S. Willis, 1850', bpb: 3, seis: 1,
    m: 'R:2 F4 | D5:2 A4 | C5 Bb4 G4 | F4:2 G4 | F4:2 F4 | G4 A4 Bb4 | Bb4 C5 D5 | C5:3 | C5:2 F4 | D5:2 A4 | C5 Bb4 G4 | F4:2 G4 | F4:2 Bb4 | G4:2 G4 | A4 G4 F4 | Bb4:3 | Bb4:2 D5 | D5:2 D4 | D4 E4 F#4 | G4:2 A4 | Bb4:2 D5 | C5 Bb4 A4 | G4 A4 G4 | F4:3 | F4:2 F4 | D5:2 A4 | C5 Bb4 G4 | F4:2 G4 | F4:2 Bb4 | G4:2 G4 | A4 G4 F4 | Bb4:3 | Bb4:3',
    c: 'Bb | Bb | Eb | Bb | Bb | Eb | C7 | F7 | F7 | Bb | Eb | Bb | Bb | Eb | F7 | Bb | Bb | D7 | D7 | Gm | Gm | F | C7 | F7 | F7 | Bb | Eb | Bb | Bb | Eb | F7 | Bb | Bb'},
  {id: 'stelle', t: 'Tu scendi dalle stelle', o: 'A. M. de’ Liguori, 1754', bpb: 3, seis: 1,
    m: 'R:2 C5 | C5:2 D5 | C5:2 Bb4 | Bb4 A4:2 | A4:2 G4 | A4 Bb4 C5 | C5 Bb4 A4 | G4:3 | G4:2 A4 | G4:2 A4 | Bb4:2 A4 | G4:3 | D5:3 | C5 D5 C5 | Bb4 A4 G4 | A4:3 | A4:2 A4 | G4:2 A4 | Bb4:2 A4 | G4:3 | D5:3 | C5 D5 C5 | Bb4 A4 G4 | F4:3 | A4 Bb4 C5 | Bb4:2 Bb4 | G4 A4 Bb4 | A4:2 A4 | A4 Bb4 C5 | Bb4:2 Bb4 | G4 A4 Bb4 | A4:3 | A4:2 G4 | A4 Bb4 C5 | C5 Bb4 A4 | G4:3 | G4:2 A4 | G4:2 A4 | Bb4:2 A4 | G4:3 | D5:3 | C5 D5 C5 | Bb4 A4 G4 | F4:3 | F4:3',
    c: 'F | F | F | F | F | F | F | C | C | C7 | C7 | C | Bb | F | C7 | F | F | C7 | C7 | C | Bb | F | C7 | F | F | C7 | C7 | F | F | C7 | C7 | F | F | F | F | C | C | C7 | C7 | C | Bb | F | C7 | F | F'},
  {id: 'belen', t: 'El portal de Belén (O Little Town of Bethlehem)', o: 'L. Redner, 1868', bpb: 4,
    m: 'R:3 B4 | B4 B4 A#4 B4 | D5 C5 E4 A4 | G4 F#4:.5 G4:.5 A4 D4 | B4:3 B4 | B4 B4 E5 D5 | D5 C5 E4 A4 | G4 F#4:.5 G4:.5 B4 A4 | G4:3 B4 | B4 B4 A4 G4 | F#4:2 F#4 F#4 | E4 F#4 G4 A4 | B4:3 B4 | B4 B4 A#4 B4 | D5 C5 E4 E5 | D5 G4 B4:1.5 A4:.5 | G4:4',
    c: 'G | G | Am | G,D7 | G | G | Am | G,D7 | G | Em | B7 | Em | B7 | G | Am | G,D7 | G'},
  {id: 'santa', t: 'Noche santa (Cantique de Noël)', o: 'A. Adam, 1847', bpb: 4,
    m: 'R:1.75 G4:.25 G4:1.75 Bb4:.25 | Bb4:1.75 Bb4:.25 C5:.75 C5:.25 Ab4:.75 C5:.25 | Eb5:2 Bb4:.75 Bb4:.25 G4:.75 F4:.25 | Eb4:.75 Eb4:.25 G4:.75 Ab4:.25 Bb4 Ab4:.75 F4:.25 | Eb4:3 R | R:2 G4 G4:.75 Bb4:.25 | Bb4:1.75 Bb4:.25 C5:.75 C5:.25 Ab4:.75 C5:.25 | Eb5:2 Bb4:.75 Bb4:.25 A4:.75 G4:.25 | D5 Bb4:.75 C5:.25 D5 Eb5:.75 D5:.25 | G4:3 R:.75 Bb4:.25 | Bb4 C5 F4 Bb4:.75 Bb4:.25 | C5:.75 Bb4:.25 Eb5:.75 G4:.25 C5 Bb4:.75 Bb4:.25 | Bb4 C5 F4 Bb4:.75 Bb4:.25 | C5:.75 Bb4:.25 Eb5:.75 G4:.25 Bb4:2 | Eb5:3 D5:.75 C5:.25 | D5:3.75 D5:.25 | F5:2.75 C5:.25 C5:.75 C5:.25 | Eb5:3 R:.75 Eb5:.25 | G5:3.75 Bb4:.25 | Eb5:3 D5:.75 C5:.25 | Bb4:2.75 Bb4:.25 C5:.75 Bb4:.25 | Bb4:3 R:.75 Eb5:.25 | F5:3.75 Bb4:.25 | G5:3 F5:.75 F5:.25 | Eb5:2 D5:.75 D5:.25 Eb5:.75 F5:.25 | Eb5:4',
    c: 'Eb | Eb,Ab | Eb | Eb,Bb7 | Eb | Eb | Eb,Ab | Eb | Gm,D7 | Gm | Bb7 | Eb | Bb7 | Eb | Cm | Gm | Fm | Cm | Eb | Ab | Eb | Bb7 | Bb7 | Eb,Ab | Eb,Bb7 | Eb'},
  {id: 'still', t: 'Still, still, still', o: 'tradicional austriaca', bpb: 4,
    m: 'C5 F5 A4 C5 | F4:3 F4:.5 A4:.5 | G4 G4:.5 Bb4:.5 E4 E4:.5 G4:.5 | F4:3 A4 | G4 G4:.5 A4:.5 Bb4 G4 | A4 A4:.5 Bb4:.5 C5 A4 | G4 G4:.5 A4:.5 Bb4 G4 | A4 A4:.5 Bb4:.5 C5 A4 | C5 F5 A4 C5 | F4:3 F4:.5 A4:.5 | G4 G4:.5 Bb4:.5 E4 E4:.5 G4:.5 | F4:4',
    c: 'F | Dm | C7 | F | C7 | F | C7 | F | F | Dm | C7 | F'},
  {id: 'emmanuel', t: 'Veni, veni, Emmanuel', o: 'melodía francesa, s. XV', bpb: 4,
    m: 'R:3 E4 | G4 B4 B4 B4 | A4 C5 B4 A4 | G4:3 A4 | B4 G4 E4 G4 | A4 F#4 E4 D4 | E4:3 A4 | A4 E4 E4 F#4 | G4:2 F#4 E4 | D4:3 G4 | A4 B4 B4 B4 | A4 C5 B4 A4 | G4:3 D5 | D5:3 B4 | B4:3 B4 | A4 C5 B4 A4 | G4:3 A4 | B4 G4 E4 G4 | A4 F#4 E4 D4 | E4:4',
    c: 'Em | Em | D | G | Em | D | Em | Am | C | G | Em | D | G | G | Em | D | G | Em | D | Em'},
  {id: 'ilestne', t: 'Il est né, le divin enfant', o: 'tradicional francesa', bpb: 4,
    m: 'F4 Bb4 Bb4 D5:.5 Bb4:.5 | F4 Bb4 Bb4:2 | Bb4 Bb4:.5 C5:.5 D5 Eb5:.5 D5:.5 | C5 Bb4 C5:.5 A4:.5 F4 | F4 Bb4 Bb4 D5:.5 Bb4:.5 | F4 Bb4 Bb4:2 | Bb4 C5 D5 Eb5:.5 D5:.5 | C5 F5 Bb4:2 | D5 Eb5 F5 Eb5:.5 D5:.5 | Eb5 G5 F5:2 | D5 Eb5 F5 G5:.5 F5:.5 | Eb5 D5 D5 C5 | D5 Eb5 F5 Eb5:.5 D5:.5 | Eb5 G5 F5:2 | D5 Eb5 F5 G5:.5 F5:.5 | Eb5 D5 C5:2 | F4 Bb4 Bb4 D5:.5 Bb4:.5 | F4 Bb4 Bb4:2 | Bb4 Bb4:.5 C5:.5 D5 Eb5:.5 D5:.5 | C5 Bb4 C5:.5 A4:.5 F4 | F4 Bb4 Bb4 D5:.5 Bb4:.5 | F4 Bb4 Bb4:2 | Bb4 C5 D5 Eb5:.5 D5:.5 | C5 F5 Bb4:2',
    c: 'Bb | Bb | Bb | F | Bb | Bb | Bb | F7,Bb | Bb | Eb,Bb | Bb | Eb,F7 | Bb | Eb,Bb | Bb | Eb,F7 | Bb | Bb | Bb | F | Bb | Bb | Bb | F7,Bb'},
  {id: 'dingdong', t: 'Ding Dong Merrily on High', o: 'danza francesa, s. XVI', bpb: 4,
    m: 'Bb4 Bb4 C5:.5 Bb4:.5 A4:.5 G4:.5 | F4:3 F4 | G4 Bb4 Bb4 A4 | Bb4:2 Bb4:2 | Bb4 Bb4 C5:.5 Bb4:.5 A4:.5 G4:.5 | F4:3 F4 | G4 Bb4 Bb4 A4 | Bb4:2 Bb4:2 | F5:1.5 Eb5:.5 D5:.5 Eb5:.5 F5:.5 D5:.5 | Eb5:1.5 D5:.5 C5:.5 D5:.5 Eb5:.5 C5:.5 | D5:1.5 C5:.5 Bb4:.5 C5:.5 D5:.5 Bb4:.5 | C5:1.5 Bb4:.5 A4:.5 Bb4:.5 C5:.5 A4:.5 | Bb4:1.5 A4:.5 G4:.5 A4:.5 Bb4:.5 G4:.5 | A4:1.5 G4:.5 F4 F4 | G4 Bb4 Bb4 A4 | Bb4:2 Bb4:2',
    c: 'Bb,Eb | F | Eb,F7 | Bb | Bb,Eb | F | Eb,F7 | Bb | Bb | Cm | Gm | F7 | Bb,Eb | F | Eb,F7 | Bb'},
  {id: 'acebo', t: 'El acebo y la hiedra (The Holly and the Ivy)', o: 'tradicional inglesa', bpb: 3,
    m: 'R:2 G4 | G4:.5 G4:.5 G4 E5 | D5 B4:1.5 G4:.5 | G4:.5 G4:.5 G4 E5 | D5:2 D5:.5 C5:.5 | B4:.5 A4:.5 G4 B4:.5 B4:.5 | E4:.5 E4:.5 D4 G4:.5 A4:.5 | B4:.5 C5:.5 B4 A4 | G4:2 R:.5 G4:.5 | G4:.5 G4:.5 G4 E5 | D5 B4 G4:.5 G4:.5 | G4:.5 G4:.5 G4 E5 | D5:2 D5:.5 C5:.5 | B4:.5 A4:.5 G4 B4 | E4:.5 E4:.5 D4 G4:.5 A4:.5 | B4:.5 C5:.5 B4 A4 | G4:3',
    c: 'G | C | G | C | D | G | C | D7 | G | C | G | C | D | G | C | D7 | G'},
  {id: 'barcos', t: 'Vi tres barcos (I Saw Three Ships)', o: 'tradicional inglesa', bpb: 3, seis: 1,
    m: 'R:2 D4 | G4:2 G4 | A4:2 B4 | D5:2 B4 | A4:2 C5 | B4:2 G4 | G4:2 B4 | A4:2 F#4 | D4:2 E4 | G4:2 G4 | A4:2 B4 | D5:2 B4 | A4:2 C5 | B4:2 G4 | G4 A4 B4 | A4:3 | G4:2 D4 | G4:2 G4 | A4:2 B4 | D5:2 B4 | A4:2 C5 | B4:2 G4 | G4:2 B4 | A4:2 F#4 | D4:2 E4 | G4:2 G4 | A4:2 B4 | D5:2 B4 | A4:2 C5 | B4:2 G4 | G4 A4 B4 | A4:3 | G4:3',
    c: 'G | G | D | G | D | G | Em | D | D | Em | D | G | D | G | Em | D7 | G | G | D | G | D | G | Em | D | D | Em | D | G | D | G | Em | D7 | G'},
  {id: 'tejado', t: 'Up on the Housetop', o: 'B. Hanby, 1864', bpb: 4,
    m: 'Bb4 Bb4:.5 C5:.5 Bb4 G4:.5 F4:.5 | Eb4 G4 Bb4:2 | C5 C5 Bb4 G4 | F4 Bb4 Bb4:2 | Bb4 Bb4:.5 C5:.5 Bb4 G4:.5 F4:.5 | Eb4 G4 Bb4:2 | C5 C5:.5 C5:.5 Bb4 G4:.5 G4:.5 | F4 Bb4 Eb4:2 | Ab4 Ab4 C5:2 | Bb4 Bb4:.5 Bb4:.5 G4:2 | F4 Ab4 Ab4:2 | G4 Bb4:.5 Bb4:.5 Eb4 G4 | Bb4 Bb4:.5 C5:.5 Bb4 G4 | Ab4 Bb4 C5:2 | Bb4 Bb4:.5 C5:.5 Bb4 G4:.5 G4:.5 | F4 Bb4 Eb4:2',
    c: 'Eb | Eb | Ab,Eb | Bb | Eb | Eb | Ab,Eb | Bb7,Eb | Ab | Eb | Bb7 | Eb | Eb | Ab | Eb | Bb7,Eb'},
  {id: 'auld', t: 'Auld Lang Syne', o: 'tradicional escocesa', bpb: 4,
    m: 'R:3 D4 | G4:1.5 G4:.5 G4 B4 | A4:1.5 G4:.5 A4 B4 | G4:1.5 G4:.5 B4 D5 | E5:3 E5 | D5:1.5 B4:.5 B4 G4 | A4:1.5 G4:.5 A4 B4 | G4:1.5 E4:.5 E4 D4 | G4:3 E5 | D5:1.5 B4:.5 B4 G4 | A4:1.5 G4:.5 A4 E5 | D5:1.5 B4:.5 B4 D5 | E5:3 G5 | D5:1.5 B4:.5 B4 G4 | A4:1.5 G4:.5 A4 B4 | G4:1.5 E4:.5 E4 D4 | G4:4',
    c: 'G | G | D7 | G | C | G | D7 | Em,D7 | G | G | D7 | G | C | G | D7 | Em,D7 | G'},
  {id: 'nicolas', t: 'Jolly Old Saint Nicholas', o: 'tradicional estadounidense, s. XIX', bpb: 4,
    m: 'B4 B4 B4 B4 | A4 A4 A4:2 | G4 G4 G4 G4 | B4:4 | E4 E4 E4 E4 | D4 D4 G4:2 | A4 G4 A4 B4 | A4:4 | B4 B4 B4 B4 | A4 A4 A4:2 | G4 G4 G4 G4 | B4:4 | E4 E4 E4 E4 | D4 D4 G4:2 | A4 G4 A4 B4 | G4:4',
    c: 'G | D | Em | Bm | C | G | A7 | D7 | G | D | Em | Bm | C | G | D7 | G'},
];

const PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}, pc = s => PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);
export const midi = s => {const m = /^([A-G][#b]?)(\d)$/.exec(s); return m ? pc(m[1]) + 12 * (+m[2] + 1) : null};
export const compases = t => t.m.split('|').map(b => b.trim().split(/\s+/).map(x => {const [n, d] = x.split(':'); return {n: n === 'R' ? 0 : midi(n), d: d ? +d : 1}}));
export const acorde = s => {const m = /^([A-G][#b]?)(m?)(7?)$/.exec(s); return {r: (pc(m[1]) + 12) % 12, q: m[2] ? 'm' : m[3] ? '7' : 'M'}};
export const acordes = t => t.c.split('|').map(b => b.trim().split(',').map(acorde));

/* números al azar con semilla */
export const azar = s => {let a = s >>> 0; return () => {a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296}};
const NUC = {M: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10]}, mod12 = x => ((x % 12) + 12) % 12;

/* ---------- el arreglo ---------- */
/* estilos: qué toca cada cosa. Se reparten entre las canciones y cambian en la segunda vuelta */
export const ESTILOS = [
  {id: 'rhodes', n: 'piano eléctrico y vibráfono', acomp: 'ep', solo: ['vibra', 'caja'], bat: 'boom', pad: 'cuerdas'},
  {id: 'guitarra', n: 'guitarra y caja de música', acomp: 'guitarra', solo: ['caja', 'guitarra'], bat: 'escoba', pad: 'cuerdas', arp: 1},
  {id: 'piano', n: 'piano de fieltro y celesta', acomp: 'piano', solo: ['celesta', 'piano'], bat: 'suave', pad: 'cuerdas'},
  {id: 'flauta', n: 'piano eléctrico y flauta', acomp: 'ep', solo: ['flauta', 'vibra'], bat: 'boom', pad: 'cuerdas'},
  {id: 'vibra', n: 'vibráfono y guitarra', acomp: 'guitarra', solo: ['vibra', 'piano'], bat: 'escoba', pad: 'cuerdas'},
  {id: 'caja', n: 'caja de música y piano', acomp: 'piano', solo: ['caja', 'flauta'], bat: 'suave', pad: 'cuerdas', arp: 1},
];
/* la lista: todas las canciones dos veces, con otro arreglo, sin que se repita ninguna hasta haber sonado las demás */
export const LISTA = (() => {
  const L = [], n = TEMAS.length; for (let v = 0; v < 2; v++) {const r = azar(2026 + v * 77), O = TEMAS.map((_, i) => i); for (let i = n - 1; i > 0; i--) {const j = Math.floor(r() * (i + 1)); [O[i], O[j]] = [O[j], O[i]]}
    if (v) {const ult = L.slice(-8).map(x => x.k); O.sort((a, b) => (ult.includes(a) ? 1 : 0) - (ult.includes(b) ? 1 : 0))}
    O.forEach((k, i) => L.push({k, v, e: (k * 5 + v * 3 + (k >> 2)) % ESTILOS.length, s: 1000 * v + k * 17 + 5, dir: i}))}
  // dos seguidas nunca con el mismo arreglo
  for (let i = 1; i < L.length; i++) if (L[i].e === L[i - 1].e) L[i].e = (L[i].e + 1 + (i % 3)) % ESTILOS.length;
  return L.map((x, i) => ({...x, i, id: TEMAS[x.k].id, t: TEMAS[x.k].t, o: TEMAS[x.k].o, n: ESTILOS[x.e].n}));
})();

const ACOMP4 = [[[0, 2.4, .9], [2.5, 1.4, .62]], [[0, 3.7, .85]], [[0, 1.4, .85], [1.5, 1.4, .55], [3, .95, .6]], [[0, 2.9, .85], [3, .9, .5]], [[0, 1.4, .8], [2, 1.9, .7]]];
const ACOMP3 = [[[0, 2.85, .85]], [[0, 1.9, .85], [2, .95, .55]], [[0, .95, .8], [1, .95, .45], [2, .95, .5]], [[0, 1.4, .8], [1.5, 1.4, .5]]];
/* una pista entera: lista de notas con su hora en segundos. Nada de audio */
export function partitura(pista) {
  const T = TEMAS[pista.k], S = ESTILOS[pista.e], r = azar(pista.s * 7919 + 13), seis = !!T.seis, bpb = T.bpb, pul = seis ? P : P * 2, bar = bpb * pul, sw = seis || bpb === 3 ? .04 : .075 + r() * .03;
  const M = compases(T), A = acordes(T), B = M.length, ev = [], add = (t, k, o) => ev.push({t: Math.max(0, t), k, ...o}), hum = (a = .012) => (r() - .5) * 2 * a;
  // tonalidad: la melodía queda en un registro cómodo, y en la segunda vuelta se cambia
  const nn = M.flat().filter(x => x.n).map(x => x.n), med = nn.reduce((a, b) => a + b, 0) / nn.length, obj = 69.5 + (pista.v ? -2 : 1) + (r() * 3 - 1.5); let tr = Math.round(obj - med); const ton = mod12(A[A.length - 1][0].r + tr), menor = A[A.length - 1][0].q === 'm';
  const tsw = p => {const e = Math.floor(p * 2) / 2, f = p - e; return (e + f) * pul + (Math.round(e * 2) % 2 ? sw * pul : 0)};   // corcheas con balanceo
  // forma: entrada, tema, puente, tema (entero o su final) y salida
  const durT = B * bar, largo = durT * 2 < 175, F = []; let nI = seis ? 8 : 4, nP = seis ? 8 : 4 + (durT < 60 ? 4 : 0); nI = Math.min(nI, B); nP = Math.min(nP, B);
  F.push({s: 'entrada', a: 0, n: nI}, {s: 'tema', a: 0, n: B, l: 0}); if (durT < 58) F.push({s: 'tema', a: 0, n: B, l: 1}); F.push({s: 'puente', a: B - nP, n: nP});
  const med2 = Math.floor(B / 2), ini2 = largo ? 0 : med2 - (seis && med2 % 2 ? 1 : 0); F.push({s: 'tema', a: ini2, n: B - ini2, l: largo && durT < 58 ? 0 : 1}); F.push({s: 'salida', a: B - nI, n: nI});
  let b0 = 0, vant = null; const nBars = F.reduce((a, f) => a + f.n, 0), pat4 = Math.floor(r() * ACOMP4.length), pat3 = Math.floor(r() * ACOMP3.length), casc = r() < .45;
  const bajoDe = c => {let n = 36 + mod12(c.r + tr); if (n > 43) n -= 12; return n};
  /* disposición de las manos: séptimas y novenas, sin chocar con la melodía, y moviéndose lo menos posible */
  const voz = (c, mel) => {
    const raiz = mod12(c.r + tr), mp = mel.map(n => mod12(n + tr)), toca = i => mp.includes(mod12(raiz + i)); let I;
    if (c.q === 'm') I = [3, 7, 10, ...(toca(3) && !toca(2) ? [] : [14])]; else if (c.q === '7') I = [4, 10, ...(toca(3) || toca(1) ? [7] : [14]), ...(toca(8) ? [] : toca(9) ? [] : [7])]; else I = toca(0) ? [4, 7, 9, 14] : toca(5) ? [4, 7, 14] : [4, 7, 11, 14];
    const pcs = [...new Set(I.map(i => mod12(raiz + i)))], cen = vant ? vant.reduce((a, b) => a + b, 0) / vant.length : 58; let best = null, bn = 1e9;
    for (let inv = 0; inv < pcs.length; inv++) for (let base = 49; base <= 59; base++) if (mod12(base) === pcs[inv]) {const V = [base]; for (let q = 1; q < pcs.length; q++) {let n = V[V.length - 1] + 1; while (mod12(n) !== pcs[(inv + q) % pcs.length]) n++; V.push(n)} const c0 = V.reduce((a, b) => a + b, 0) / V.length, ab = V[V.length - 1] - V[0], pen = Math.abs(c0 - cen) + Math.abs(c0 - 59) * .5 + (V[V.length - 1] > 70 ? 6 : 0) + (V[1] - V[0] < 2 ? 2 : 0) + Math.max(0, ab - 14); if (pen < bn) {bn = pen; best = V}}
    vant = best; return best;
  };
  const tocaAc = (inst, V, t, d, v, ras) => V.forEach((n, i) => add(t + i * ras + hum(.004), inst, {n, d: Math.max(.3, d - i * ras), v: v * (.88 + r() * .18) * (i === V.length - 1 ? 1.04 : .92), bus: 'ac'}));
  F.forEach((f, fi) => {
    const solo = S.solo[(f.l + (pista.v ? 1 : 0)) % S.solo.length], ult = fi === F.length - 1;
    for (let q = 0; q < f.n; q++) {
      const bi = f.a + q, t0 = (b0 + q) * bar, cs = A[bi], notas = M[bi], abs = b0 + q, fin = ult ? Math.max(.25, 1 - q / f.n * .7) : 1, tema = f.s === 'tema', bat = (tema && !(fi === 1 && q < (seis ? 4 : 2) && r() < 2)) || (f.s === 'puente' && q >= f.n - 1);
      // acordes: piano, guitarra…
      cs.forEach((c, ci) => {
        const pos = ci * bpb / cs.length, len = bpb / cs.length; let acu = 0; const mel = []; for (const x of notas) {if (x.n && tema && acu + x.d > pos && acu < pos + len && x.d >= .5) mel.push(x.n); acu += x.d}
        const V = voz(c, mel), tt = t0 + pos * pul;
        if (f.s === 'salida' && q === f.n - 1) {if (!ci) {tocaAc(S.acomp, V, tt, bar * 2.4, .6, .07); add(tt, 'bajo', {n: bajoDe(c), d: bar * 1.6, v: .55})} return}
        if (S.arp && (tema || f.s === 'entrada')) {
          const paso = seis ? 1 : .5, N = Math.round(len / paso), ord = [0, 2, 1, 3, 2, 1, 3, 2]; for (let k = 0; k < N; k++) {const idx = ord[k % ord.length] % V.length, p = pos + k * paso; add(t0 + tsw(p) + hum(.006), S.acomp, {n: V[idx] + (k % 8 === 6 && r() < .3 ? 12 : 0), d: pul * paso * 2.6, v: (k === 0 ? .62 : .42 + r() * .12) * fin, bus: 'ac'})}
        } else {
          const PT = len < bpb ? [[0, len * .95, .8]] : bpb === 3 ? ACOMP3[seis ? (q % 2 ? 1 : 0) : (pat3 + (q % 4 === 3 ? 1 : 0)) % ACOMP3.length] : ACOMP4[(pat4 + (q % 4 === 3 ? 1 : 0)) % ACOMP4.length];
          PT.forEach(([p, d, v]) => tocaAc(S.acomp, V, t0 + tsw(pos + p) + hum(.008), d * pul, v * (.62 + (tema ? 0 : .1)) * fin, S.acomp === 'guitarra' ? .022 : .009));
        }
        if (f.s === 'puente' || (tema && f.l === 1)) V.slice(0, 3).forEach(n => add(tt, S.pad, {n, d: len * pul + .5, v: .34 * fin, bus: 'pad'}));
        // bajo
        if (tema || (f.s === 'puente' && q > 0)) {
          const bn = bajoDe(c), sig = ci < cs.length - 1 ? cs[ci + 1] : A[Math.min(B - 1, bi + 1)][0], bs = bajoDe(sig); add(tt + hum(.006), 'bajo', {n: bn, d: pul * Math.min(len, seis ? 2.8 : 2.2), v: .8 * fin});
          if (len >= 4 && r() < .75) add(t0 + tsw(pos + 2.5) + hum(.006), 'bajo', {n: r() < .6 ? bn : bn + (c.q === 'm' && 0) + 7 > 48 ? bn : bn + 7, d: pul * 1.1, v: .58 * fin}); else if (len === 3 && !seis && r() < .5) add(t0 + (pos + 2) * pul, 'bajo', {n: bn + 7 > 47 ? bn : bn + 7, d: pul * .9, v: .5 * fin});
          if (len >= 4 && bs !== bn && r() < .35) add(t0 + tsw(pos + 3.5), 'bajo', {n: bs + (bs > bn ? -1 : 1) === bn ? bs : bs + (bs > bn ? -2 : 2), d: pul * .45, v: .42 * fin});
        }
      });
      // melodía
      if (tema) {let p = 0; notas.forEach((x, i) => {
        if (x.n) {
          const oct = solo === 'caja' || solo === 'celesta' ? 12 : solo === 'vibra' ? (med + tr < 70 ? 12 : 0) : 0, n = x.n + tr + oct, f1 = p % 1 === 0 ? 1 : .82, tn = t0 + (p % 1 === .5 ? tsw(p) : p * pul) + .012 + hum(.011); let d = x.d * pul; if (solo === 'flauta') d *= .94;
          add(tn, solo, {n, d: solo === 'flauta' ? d : d + .5, v: (.66 + .16 * f1 + (p === 0 ? .06 : 0)) * (.93 + r() * .12), bus: 'so'});
          // adornos en la segunda: alguna nota de paso antes o una tercera por debajo
          if (f.l === 1 && x.d >= 1 && r() < .14) add(tn - .085, solo, {n: n + (r() < .5 ? -1 : 2), d: .2, v: .3, bus: 'so'});
          if (f.l === 1 && x.d >= 2 && r() < .4) add(tn + pul, solo, {n: n + 12 > 98 ? n : n + (r() < .5 ? 7 : 12), d: pul, v: .26, bus: 'so'});
        }
        p += x.d;
      })}
      // puente: cuatro notas sueltas sobre el acorde, como quien piensa
      if (f.s === 'puente') {const c = cs[0], esc = c.q === 'm' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9], ra = mod12(c.r + tr); let k = Math.floor(r() * 5); for (let p = r() < .5 ? .5 : 1; p < bpb; p += r() < .4 ? .5 : r() < .6 ? 1 : 1.5) if (r() < .72) {k = Math.max(0, Math.min(9, k + Math.round((r() - .5) * 3.4))); let n = 60 + ra + esc[k % 5] + 12 * Math.floor(k / 5); while (n > 82) n -= 12; while (n < 64) n += 12; const inst = S.solo[1]; add(t0 + tsw(p) + hum(), inst, {n: n + (inst === 'caja' || inst === 'celesta' ? 12 : 0), d: pul * 1.3, v: .34 + r() * .2, bus: 'so'})}}
      // batería
      if (bat) {
        const v = fin * (fi === 1 && q < 4 ? .8 : 1), K = (p, w) => add(t0 + tsw(p) + hum(.004), 'bombo', {v: w * v}), Sn = (p, w) => add(t0 + tsw(p) + .014 + hum(.005), S.bat === 'boom' ? 'tarola' : S.bat === 'escoba' ? 'escoba' : 'aro', {v: w * v}), H = (p, w, o) => add(t0 + tsw(p) + hum(.005), o ? 'charlesA' : 'charles', {v: w * v * (.8 + r() * .35)});
        if (bpb === 4) {K(0, .9); if (S.bat !== 'suave' || q % 2) K(2.5, .62); if (r() < .22) K(1.75, .38); Sn(1, .62); Sn(3, .66); if (r() < .2) Sn(3.75, .2); for (let p = 0; p < 4; p += .5) if (p % 1 === 0 || r() < .86) H(p, p % 1 ? .26 : .36); if (q % 8 === 7) H(3.5, .3, 1)}
        else if (seis) {if (abs % 2 === 0) {K(0, .85); if (r() < .3) K(2, .4)} else Sn(0, .6); for (let p = 0; p < 3; p++) H(p, p ? .22 : .34)}
        else {K(0, .85); if (r() < .25) K(1.5, .36); Sn(1, .3); Sn(2, .52); for (let p = 0; p < 3; p += .5) if (p % 1 === 0 || r() < .6) H(p, p % 1 ? .2 : .32)}
        if (casc && tema) for (let p = 0; p < bpb; p++) add(t0 + p * pul + hum(.006), 'cascabel', {v: (p % 2 ? .13 : .2) * v * (seis && p ? .5 : 1)});
      }
    }
    b0 += f.n;
  });
  const dur = nBars * bar + 2.6; ev.sort((a, b) => a.t - b.t); return {ev, dur, bar, pul, ton, menor, tr, F, usa: [...new Set(ev.map(e => e.k))], pista};
}
export const duracion = i => partitura(LISTA[i]).dur;
