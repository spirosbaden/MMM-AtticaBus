# MMM-AtticaBus

**MMM-AtticaBus** is a [MagicMirror²](https://magicmirror.builders/) module for displaying real-time **Athens bus** arrival information using the **OASA telematics** service.

It is designed for monitoring **public transportation in Athens, Greece**, directly from a MagicMirror² smart mirror. The module supports multiple bus stops, specific bus lines, automatic updates, and a nearby-stop fallback when a requested bus is not currently available at the selected stop.

## Features

* 🚌 **Real-time arrivals**
  Displays the expected arrival time of buses at the selected stop.

* 📍 **Multiple bus stops**
  Configure and monitor as many stops as you need.

* 🔢 **Bus line filtering**
  Display only specific bus lines, such as `021` or `046`.

* 🔎 **Nearby stop fallback**
  If the requested bus is not currently available at the configured stop, the module can search nearby stops served by the same bus line and display the nearest available arrival.

* 🔄 **Automatic updates**
  Arrival information is refreshed automatically at the configured interval.

* 🪶 **Lightweight design**
  Designed to fit naturally into a MagicMirror² setup without unnecessary UI elements.

---

## Installation

Navigate to your MagicMirror modules directory:

```bash
cd ~/MagicMirror/modules
```

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/MMM-AtticaBus.git
```

Enter the module directory:

```bash
cd MMM-AtticaBus
```

Install the required dependencies:

```bash
npm install
```

> If the module does not have any external dependencies, `npm install` may not be necessary.

---

## Configuration

Add the following configuration to your MagicMirror² `config/config.js` file:

```javascript
{
    module: "MMM-AtticaBus",
    position: "top_center",

    config: {
        updateInterval: 30000,

        stations: [
            {
                stopId: "060014",
                title: "🏠 Σπίτι - Αιγάλεω",
                buses: ["021"]
            },
            {
                stopId: "060034",
                title: "🏢 Γουδή - Μαράσλειος",
                buses: ["046"]
            },
            {
                stopId: "060002",
                title: "🚏 Σύνταγμα",
                buses: []
            }
        ]
    }
}
```

### Configuration options

| Option           | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `updateInterval` | Update interval in milliseconds. `30000` = 30 seconds. |
| `stations`       | List of bus stops to monitor.                          |
| `stopId`         | OASA stop code.                                        |
| `title`          | Text displayed above the arrivals for the stop.        |
| `buses`          | Array of bus line numbers to display.                  |

### Monitoring all bus lines

If `buses` is empty, the module displays all available bus arrivals for the configured stop:

```javascript
{
    stopId: "060002",
    title: "🚏 Σύνταγμα",
    buses: []
}
```

### Monitoring specific bus lines

To display only specific lines, add their line numbers to the `buses` array:

```javascript
{
    stopId: "060014",
    title: "🏠 Σπίτι - Αιγάλεω",
    buses: ["021"]
}
```

Multiple lines can be specified:

```javascript
{
    stopId: "060014",
    title: "🏠 Σπίτι - Αιγάλεω",
    buses: ["021", "550"]
}
```

---

## Nearby Stop Fallback

When specific bus lines are configured, the module first checks the selected stop.

If no vehicle from the requested line is currently arriving, MMM-AtticaBus searches nearby stops that are served by the same bus route and checks them in order of distance.

This means that, for example, if bus `021` is not currently available at the configured stop but is approaching a nearby stop, the module can display the arrival from the nearest suitable stop.

This fallback is especially useful when a bus has already passed one stop but is still approaching another nearby stop.

---

## Display

A typical result looks like:

```text
🏠 Σπίτι - Αιγάλεω

• 021: σε 6'
```

If the requested line is not currently available at the configured stop but is available nearby, the module can indicate the nearby stop as well.

---

## Data Source

Arrival information is provided by the **OASA (Athens Urban Transport Organization) telematics service**.

The module communicates with the OASA telematics API to retrieve:

* Bus stop information
* Bus line information
* Route information
* Real-time arrival times

The availability and accuracy of the displayed information depend on the OASA telematics service.

---

## Requirements

* [MagicMirror²](https://magicmirror.builders/)
* Node.js version compatible with your MagicMirror² installation
* Internet connection
* Access to the OASA telematics service

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for details.

---

# MMM-AtticaBus 🇬🇷

Το **MMM-AtticaBus** είναι ένα module για το [MagicMirror²](https://magicmirror.builders/) που εμφανίζει σε πραγματικό χρόνο τις **αφίξεις λεωφορείων της Αθήνας**, χρησιμοποιώντας την υπηρεσία **τηλεματικής του ΟΑΣΑ**.

Έχει σχεδιαστεί για την παρακολούθηση των **δημόσιων συγκοινωνιών της Αθήνας και της Αττικής**, απευθείας από ένα Smart Mirror με MagicMirror². Το module υποστηρίζει πολλαπλές στάσεις, συγκεκριμένες γραμμές λεωφορείων, αυτόματη ενημέρωση και αναζήτηση κοντινής στάσης όταν το ζητούμενο λεωφορείο δεν είναι διαθέσιμο στην επιλεγμένη στάση.

## Χαρακτηριστικά

* 🚌 **Ζωντανές αφίξεις**
  Εμφανίζει σε πόσα λεπτά αναμένεται να φτάσει το λεωφορείο στη συγκεκριμένη στάση.

* 📍 **Πολλαπλές στάσεις**
  Μπορείτε να παρακολουθείτε όσες στάσεις θέλετε.

* 🔢 **Φιλτράρισμα γραμμών**
  Μπορείτε να εμφανίζετε μόνο συγκεκριμένες γραμμές, όπως `021` ή `046`.

* 🔎 **Αναζήτηση κοντινής στάσης**
  Αν το ζητούμενο λεωφορείο δεν είναι διαθέσιμο στην επιλεγμένη στάση, το module μπορεί να αναζητήσει κοντινές στάσεις που εξυπηρετούν την ίδια γραμμή και να εμφανίσει την κοντινότερη διαθέσιμη άφιξη.

* 🔄 **Αυτόματη ενημέρωση**
  Τα δεδομένα ανανεώνονται αυτόματα στο χρονικό διάστημα που έχει οριστεί.

* 🪶 **Ελαφρύς σχεδιασμός**
  Σχεδιασμένο ώστε να ταιριάζει φυσικά σε ένα Smart Mirror χωρίς περιττά στοιχεία.

---

## Εγκατάσταση

Μεταβείτε στον φάκελο των modules του MagicMirror:

```bash
cd ~/MagicMirror/modules
```

Κάντε clone το repository:

```bash
git clone https://github.com/YOUR_USERNAME/MMM-AtticaBus.git
```

Μεταβείτε στον φάκελο του module:

```bash
cd MMM-AtticaBus
```

Εγκαταστήστε τις απαιτούμενες εξαρτήσεις:

```bash
npm install
```

> Εάν το module δεν χρησιμοποιεί εξωτερικές εξαρτήσεις, το `npm install` ενδέχεται να μην είναι απαραίτητο.

---

## Ρύθμιση

Προσθέστε το παρακάτω block στο `config/config.js` του MagicMirror²:

```javascript
{
    module: "MMM-AtticaBus",
    position: "top_center",

    config: {
        updateInterval: 30000,

        stations: [
            {
                stopId: "060014",
                title: "🏠 Σπίτι - Αιγάλεω",
                buses: ["021"]
            },
            {
                stopId: "060034",
                title: "🏢 Γουδή - Μαράσλειος",
                buses: ["046"]
            },
            {
                stopId: "060002",
                title: "🚏 Σύνταγμα",
                buses: []
            }
        ]
    }
}
```

### Επιλογές ρύθμισης

| Επιλογή          | Περιγραφή                                                                  |
| ---------------- | -------------------------------------------------------------------------- |
| `updateInterval` | Το χρονικό διάστημα ενημέρωσης σε milliseconds. `30000` = 30 δευτερόλεπτα. |
| `stations`       | Η λίστα των στάσεων που θέλετε να παρακολουθείτε.                          |
| `stopId`         | Ο κωδικός της στάσης στον ΟΑΣΑ.                                            |
| `title`          | Ο τίτλος που εμφανίζεται πάνω από τις αφίξεις της στάσης.                  |
| `buses`          | Οι γραμμές λεωφορείων που θέλετε να εμφανίζονται.                          |

### Εμφάνιση όλων των γραμμών

Αν το `buses` είναι κενό, το module εμφανίζει όλες τις διαθέσιμες αφίξεις της συγκεκριμένης στάσης:

```javascript
{
    stopId: "060002",
    title: "🚏 Σύνταγμα",
    buses: []
}
```

### Εμφάνιση συγκεκριμένων γραμμών

Για να εμφανίζονται μόνο συγκεκριμένες γραμμές:

```javascript
{
    stopId: "060014",
    title: "🏠 Σπίτι - Αιγάλεω",
    buses: ["021"]
}
```

Μπορούν να οριστούν περισσότερες από μία γραμμές:

```javascript
{
    stopId: "060014",
    title: "🏠 Σπίτι - Αιγάλεω",
    buses: ["021", "550"]
}
```

---

## Αναζήτηση κοντινής στάσης

Όταν έχουν οριστεί συγκεκριμένες γραμμές, το module ελέγχει πρώτα την επιλεγμένη στάση.

Αν δεν υπάρχει διαθέσιμο λεωφορείο της ζητούμενης γραμμής, αναζητά κοντινές στάσεις που εξυπηρετούν την ίδια γραμμή και τις ελέγχει με σειρά απόστασης.

Έτσι, για παράδειγμα, αν το `021` δεν είναι διαθέσιμο στην αρχική στάση αλλά υπάρχει διαθέσιμο σε μία κοντινή στάση, το module μπορεί να εμφανίσει την άφιξη από την κοντινότερη κατάλληλη στάση.

Αυτό είναι ιδιαίτερα χρήσιμο όταν ένα λεωφορείο έχει ήδη περάσει από μία στάση αλλά πλησιάζει σε μία άλλη κοντινή στάση.

---

## Πηγή δεδομένων

Τα δεδομένα των αφίξεων παρέχονται από την **τηλεματική υπηρεσία του ΟΑΣΑ**.

Το module χρησιμοποιεί την υπηρεσία τηλεματικής για την ανάκτηση:

* Πληροφοριών στάσεων
* Πληροφοριών γραμμών
* Πληροφοριών δρομολογίων
* Χρόνων πραγματικών αφίξεων

Η διαθεσιμότητα και η ακρίβεια των πληροφοριών εξαρτώνται από την υπηρεσία τηλεματικής του ΟΑΣΑ.

---

## Απαιτήσεις

* [MagicMirror²](https://magicmirror.builders/)
* Node.js συμβατό με την εγκατάσταση του MagicMirror²
* Σύνδεση στο Internet
* Πρόσβαση στην υπηρεσία τηλεματικής του ΟΑΣΑ

---

## Άδεια

Το project διατίθεται με άδεια **MIT License**.

Δείτε το αρχείο `LICENSE` για περισσότερες πληροφορίες.
