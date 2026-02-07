document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    let currentLat = null;
    let currentLon = null;
    let pray = null;

    // Setup navigation handlers
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Show corresponding section
            sections.forEach(sec => sec.classList.remove('active'));
            const target = btn.dataset.section;
            document.getElementById(target).classList.add('active');
        });
    });

    // Initialize prayer times library once
    function initPrayTime() {
        pray = new PrayTime('MWL');
        // Format times in 24h format by default
        pray.format('24h');
        // Use system timezone
        pray.timezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }

    // Update the prayer times table
    function updatePrayerTimes(lat, lon) {
        if (!pray) initPrayTime();
        // Set location
        pray.location([lat, lon]);
        // Get times for today
        const date = new Date();
        const times = pray.getTimes(date, [lat, lon]);
        const tbody = document.querySelector('#times-table tbody');
        tbody.innerHTML = '';
        const labels = {
            fajr: 'Fajr',
            sunrise: 'Sunrise',
            dhuhr: 'Dhuhr',
            asr: 'Asr',
            maghrib: 'Maghrib',
            isha: 'Isha'
        };
        for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.textContent = labels[key];
            const timeTd = document.createElement('td');
            timeTd.textContent = times[key];
            tr.appendChild(nameTd);
            tr.appendChild(timeTd);
            tbody.appendChild(tr);
        }
        document.getElementById('times-error').textContent = '';
    }

    // Compute Qibla direction in degrees from true north
    function computeQibla(lat, lon) {
        // Coordinates of Kaaba in degrees
        const kaabaLat = 21.4225;
        const kaabaLon = 39.8262;
        // Convert to radians
        const phi1 = lat * Math.PI / 180;
        const phi2 = kaabaLat * Math.PI / 180;
        const deltaL = (kaabaLon - lon) * Math.PI / 180;
        const q = Math.atan2(Math.sin(deltaL), Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaL));
        let degrees = q * 180 / Math.PI;
        degrees = (degrees + 360) % 360;
        return degrees;
    }

    // Update the Qibla compass
    function updateQibla(lat, lon) {
        const deg = computeQibla(lat, lon);
        const arrow = document.getElementById('qibla-arrow');
        const degreeSpan = document.getElementById('qibla-degree');
        degreeSpan.textContent = deg.toFixed(2);
        // Rotate arrow; negative deg because CSS rotates clockwise
        // Center the arrow in the compass and rotate based on Qibla direction
        arrow.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
        arrow.style.opacity = 1;
        document.getElementById('qibla-error').textContent = '';
    }

    /**
     * Attempt to compute the Gregorian date of the first day of Ramadan for a
     * given Gregorian year. If the Hijri conversion library (hijri-date) is
     * available, it will be used to determine the exact start based on the
     * Umm‑al‑Qura calendar. If the library is unavailable or throws an error,
     * the function falls back to a predefined table of dates for years
     * currently supported by this mini app (e.g. 2025, 2026). The fallback
     * dates are drawn from reputable sources such as Islamic Relief and the
     * Old Farmer’s Almanac【977201425253758†L418-L425】【575792350171349†L145-L160】. If the
     * given year is not in the table, the start date is approximated by
     * subtracting 11 days from the previous year’s start (the average drift of
     * the lunar calendar) and adjusting into the same year if necessary.
     *
     * @param {number} gYear Gregorian year for which to compute Ramadan start.
     * @returns {Date} The estimated Gregorian date for the first day of Ramadan.
     */
    function computeRamadanStartDate(gYear) {
        // Fallback table of known Ramadan start and end dates (inclusive)
        const ramadanData = {
            2025: { start: '2025-02-28', end: '2025-03-30' },
            2026: { start: '2026-02-17', end: '2026-03-18' }
            // Additional years can be added here as needed
        };

        // If HijriDate and toHijri are available, try to compute accurately
        try {
            if (typeof toHijri === 'function' && typeof HijriDate !== 'undefined') {
                const janFirst = new Date(gYear, 0, 1);
                const hijriJan = toHijri(janFirst);
                let hYear = hijriJan.year;
                const hMonth = hijriJan.month;
                const hDay = hijriJan.date;
                // If Jan 1 is already after Ramadan (month 9) or during Ramadan but after day 1,
                // Ramadan for that hijri year has already occurred; use next hijri year
                if (hMonth > 9 || (hMonth === 9 && hDay > 1)) {
                    hYear += 1;
                }
                const hijriStart = new HijriDate(hYear, 9, 1);
                return hijriStart.toGregorian();
            }
        } catch (e) {
            console.warn('Hijri conversion unavailable, falling back to predefined dates.');
        }
        // Fall back to predefined dates
        if (ramadanData[gYear]) {
            // Force noon time to avoid timezone shifting to previous day when
            // converting to local date. Using 12:00 ensures the date remains
            // correct in most time zones.
            const isoStart = ramadanData[gYear].start + 'T12:00:00';
            return new Date(isoStart);
        }
        // Approximate by subtracting 11 days from previous year's start (lunar drift)
        const prevYearStart = ramadanData[gYear - 1] ? new Date(ramadanData[gYear - 1].start) : new Date(gYear - 1, 2, 1);
        const approx = new Date(prevYearStart);
        approx.setDate(prevYearStart.getDate() - 11);
        // Ensure the approximated date falls within the requested year; if it falls into previous year, add a year
        if (approx.getFullYear() < gYear) {
            approx.setFullYear(gYear);
        }
        return approx;
    }

    // Generate Ramadan schedule table
    function generateRamadanSchedule() {
        const yearInput = document.getElementById('ramadan-year');
        const gYear = parseInt(yearInput.value, 10);
        if (isNaN(gYear)) {
            document.getElementById('ramadan-error').textContent = 'Please enter a valid year.';
            return;
        }
        if (currentLat === null || currentLon === null) {
            document.getElementById('ramadan-error').textContent = 'Location data is required for calculating fasting times.';
            return;
        }
        // Determine start date of Ramadan
        const start = computeRamadanStartDate(gYear);
        // Determine end date: if Hijri library available, compute 30th Ramadan; otherwise use fallback table or 29–30 days after start
        let end;
        try {
            if (typeof HijriDate !== 'undefined' && typeof toHijri === 'function') {
                const hijriStart = toHijri(start);
                const hijriYear = hijriStart.year;
                const endHijri = new HijriDate(hijriYear, 9, 30);
                end = endHijri.toGregorian();
            }
        } catch (e) {
            // ignore
        }
        if (!end) {
            // Check fallback table
            const fallback = {
                2025: '2025-03-30T12:00:00',
                2026: '2026-03-18T12:00:00'
            };
            if (fallback[gYear]) {
                end = new Date(fallback[gYear]);
            } else {
                // approximate: 29 days after start (lunar months are 29 or 30 days)
                end = new Date(start);
                end.setDate(start.getDate() + 29);
            }
        }
        // Prepare range text
        let hijriRange = '';
        let gregStartStr = start.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        let gregEndStr = end.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        // Try to compute Hijri range for display
        try {
            if (typeof toHijri === 'function') {
                const hStart = toHijri(start);
                const hEnd = toHijri(end);
                const hStartStr = `${hStart.date} ${getHijriMonthName(hStart.month)} ${hStart.year}`;
                const hEndStr = `${hEnd.date} ${getHijriMonthName(hEnd.month)} ${hEnd.year}`;
                hijriRange = `Hijri: ${hStartStr} – ${hEndStr} | `;
            }
        } catch (e) {
            // skip
        }
        document.getElementById('ramadan-range').textContent = `${hijriRange}Gregorian: ${gregStartStr} – ${gregEndStr}`;
        // Populate table for each day between start and end (inclusive)
        const tbody = document.querySelector('#ramadan-table tbody');
        tbody.innerHTML = '';
        let currentDate = new Date(start);
        let dayCount = 1;
        while (currentDate <= end && dayCount <= 30) {
            const gDate = new Date(currentDate);
            let hijriLabel = '';
            try {
                if (typeof toHijri === 'function') {
                    const hijri = toHijri(gDate);
                    hijriLabel = `${hijri.date} ${getHijriMonthName(hijri.month)} ${hijri.year}`;
                }
            } catch (e) {
                // fallback: show day number of Ramadan
                hijriLabel = `Day ${dayCount}`;
            }
            // Compute prayer times for this date
            const times = pray.getTimes(gDate, [currentLat, currentLon]);
            // Build row
            const tr = document.createElement('tr');
            const dateTd = document.createElement('td');
            dateTd.textContent = gDate.toLocaleDateString();
            const hijriTd = document.createElement('td');
            hijriTd.textContent = hijriLabel || `Day ${dayCount}`;
            const fajrTd = document.createElement('td');
            fajrTd.textContent = times.fajr;
            const maghribTd = document.createElement('td');
            maghribTd.textContent = times.maghrib;
            tr.appendChild(dateTd);
            tr.appendChild(hijriTd);
            tr.appendChild(fajrTd);
            tr.appendChild(maghribTd);
            tbody.appendChild(tr);
            // Increment
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
        document.getElementById('ramadan-error').textContent = '';
    }

    // Helper to get Hijri month names
    function getHijriMonthName(month) {
        const names = ['Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani", 'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Shaʻban', 'Ramadan', 'Shawwal', 'Dhu al-Qiʻdah', 'Dhu al-Hijjah'];
        return names[month - 1] || '';
    }

    // Tasbih functionality
    let tasbihCount = 0;
    const tasbihDisplay = document.getElementById('tasbih-count');
    const tasbihContainer = document.getElementById('tasbih-container');
    const tasbihIncreaseBtn = document.getElementById('tasbih-increase');
    const tasbihResetBtn = document.getElementById('tasbih-reset');
    function updateTasbih() {
        tasbihDisplay.textContent = tasbihCount;
    }
    function increaseTasbih() {
        tasbihCount += 1;
        updateTasbih();
    }
    function resetTasbih() {
        tasbihCount = 0;
        updateTasbih();
    }
    tasbihContainer.addEventListener('click', increaseTasbih);
    tasbihIncreaseBtn.addEventListener('click', increaseTasbih);
    tasbihResetBtn.addEventListener('click', resetTasbih);

    // Event listener for Ramadan generation
    document.getElementById('generate-ramadan').addEventListener('click', generateRamadanSchedule);

    // Request geolocation
    function requestLocation() {
        if (!navigator.geolocation) {
            document.getElementById('times-error').textContent = 'Geolocation is not supported by your browser.';
            // Use default coordinates (Mecca)
            currentLat = 21.3891;
            currentLon = 39.8579;
            document.getElementById('location-display').textContent = 'Mecca (default)';
            updatePrayerTimes(currentLat, currentLon);
            updateQibla(currentLat, currentLon);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                const display = `${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`;
                document.getElementById('location-display').textContent = display;
                updatePrayerTimes(currentLat, currentLon);
                updateQibla(currentLat, currentLon);
            },
            (error) => {
                console.error(error);
                document.getElementById('times-error').textContent = 'Unable to retrieve your location. Using default (Mecca).';
                currentLat = 21.3891;
                currentLon = 39.8579;
                document.getElementById('location-display').textContent = 'Mecca (default)';
                updatePrayerTimes(currentLat, currentLon);
                updateQibla(currentLat, currentLon);
            }
        );
    }

    // Kick off
    requestLocation();
});