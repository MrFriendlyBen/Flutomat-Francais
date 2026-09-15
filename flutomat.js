/**
 * @fileoverview Flutomat NG - Modernized Flute Calculator
 * Calculates transverse flute finger hole and embouchure positions based on
 * acoustic principles, incorporating temperature-dependent speed of sound.
 */

/**
 * Represents and calculates flute dimensions.
 * @class
 */
class FluteCalculator {
    /**
     * Initializes the calculator and sets up UI listeners.
     */
    constructor() {
        /** @const {number} Number of finger holes (fixed in this implementation) */
        this.HOLE_COUNT = 6;
        this.activeHoleCount = 6;

        /** @const {number} Standard conversion */
        this.CM_TO_INCH = 0.3937008;

        // --- Configuration Constants ---
        /** @const {number} Standard acoustic end correction factor (dimensionless). */
        this.END_CORRECTION_FACTOR = 0.6133;
        /** @const {number} Factor for effective hole height extension (dimensionless). */
        this.HOLE_HEIGHT_EXTENSION_FACTOR = 0.75;
        /** @const {number} MIDI note number for A4 tuning reference. */
        this.MIDI_A4_NOTE = 69;
        /** @const {number} Frequency of A4 tuning reference (Hz). */
        this.A4_FREQUENCY_HZ = 440.0;
		//this.A4_FREQUENCY_HZ = Number(this.a4FrequencyInput?.value) || 440.0;
        /** @const {number[]} Major scale intervals in semitones relative to root [Root, M2, M3, P4, P5, M6, M7]. */
        this.MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // Used for Fend, Hole1..6

        // --- DOM Element References ---
        this.form = document.getElementById('fluteForm');
        this.unitInputs = document.querySelectorAll('input[name="units"]');
        this.tempInput = document.getElementById('temperature');
        this.tempUnitSelect = document.getElementById('tempUnit');
		this.a4FrequencyInput = document.getElementById('a4Frequency');
        this.speedOfSoundDisplay = document.getElementById('speedOfSoundDisplay');
        this.boreDiameterInput = document.getElementById('boreDiameter');
        this.wallThicknessInput = document.getElementById('wallThickness');
        this.embouchureDiameterInput = document.getElementById('embouchureDiameter');
        this.endFrequencyInput = document.getElementById('endFrequency');
        this.keySelector = document.getElementById('keySelector');
        this.intervalSequenceInput = document.getElementById('intervalSequence');
        this.scalePresetSelect = document.getElementById('scalePreset');
        this.calculateButton = document.getElementById('calculateButton');
        this.resetButton = document.getElementById('resetButton');
        this.resultEmbouchureOutput = document.getElementById('resultEmbouchure');
        this.resultEndOutput = document.getElementById('resultEnd');
        this.renderedFluteElement = document.getElementById('renderedFlute');
        this.printButton = document.getElementById('printButton');
		this.reportButton = document.getElementById('reportButton');
		this.saveFluteButton=document.getElementById('saveFluteButton');
		this.loadFluteButton=document.getElementById('loadFluteButton');
		//this.exportJsonButton=document.getElementById('exportJsonButton');
		//this.importJsonButton=document.getElementById('importJsonButton');
		this.shareUrlButton=document.getElementById('shareUrlButton');
		this.jsonFileInput=document.getElementById('jsonFileInput');
		this.resultEmbouchureFractionOutput = document.getElementById('resultEmbouchureFraction');
        /** @type {HTMLInputElement[]} */
        this.holeFrequencyInputs = [];
        /** @type {HTMLInputElement[]} */
        this.holeDiameterInputs = [];
        /** @type {HTMLOutputElement[]} */
        this.holeResultOutputs = [];
		this.holeFractionOutputs = [];
        this.holeRows = [];
        document.querySelectorAll('.hole-row').forEach(row => {
            const index = parseInt(row.dataset.holeIndex, 10);
            this.holeRows[index] = row;
            // Store in reverse order of display (index 0 = lowest pitch hole 1)
            this.holeFrequencyInputs[index] = row.querySelector('input[name="holeFrequency"]');
            this.holeDiameterInputs[index] = row.querySelector('input[name="holeDiameter"]');
            this.holeResultOutputs[index] = row.querySelector('output[name="resultHole"]');
			this.holeFractionOutputs[index] = document.getElementById(`result${index+1}Fraction`);
        });
        this.fajardoWedgeCheckbox = document.getElementById('fajardoWedge');
        this.wedgeIntensityInput = document.getElementById('wedgeIntensity');
        this.wedgeValueDisplay = document.getElementById('wedgeValue');
        // --- Internal State Variables ---
        /** @type {'cm' | 'inches'} The unit system currently selected. */
        this.units = 'inches';
        /** @type {number} Ambient temperature in Celsius. */
        this.temperatureCelsius = 20;
        /** @type {number} Speed of sound in the current unit system (cm/s or inches/s). */
        this.speedOfSound = 0;
        /** @type {number} Flute bore inner diameter in current units. */
        this.boreDiameter = 0;
        /** @type {number} Flute wall thickness in current units. */
        this.wallThickness = 0;
        /** @type {number} Embouchure hole diameter in current units. */
        this.embouchureDiameter = 0;
        /** @type {number} Target frequency for the fundamental note (all holes closed) in Hz. */
        this.endFrequency = 0;
        /**
         * @typedef {object} FluteHole
         * @property {number} frequency - Target frequency in Hz when this is the first open hole.
         * @property {number} diameter - Diameter of the hole in current units.
         * @property {number} acousticPosition - Calculated acoustic distance from the theoretical start of the air column.
         * @property {number} physicalPosition - Calculated physical distance from the open end of the flute.
         */
        /** @type {FluteHole[]} Array storing data for each finger hole (index 0 = hole 1 lowest pitch). */
        this.holes = [];

        /** @type {number} Calculated acoustic distance of the effective end of the flute from the theoretical start. */
        this.acousticEndX = 0;
        /** @type {number} Calculated acoustic distance of the embouchure center from the theoretical start. */
        this.embouchureAcousticX = 0;
        /** @type {number} Calculated physical distance of the embouchure center from the open end. */
        this.embouchurePhysicalPosition = 0;

        this._bindEvents();
        this.readInputsFromForm(); // Load initial values
        this.updateSpeedOfSoundDisplay(); // Show initial speed of sound
        this.updateFrequenciesFromKey(); // Set initial frequencies based on default key

        this.calculateAllPositions();

		const params=
    		new URLSearchParams(
        		location.search
    		);

		const flute=
    		params.get("flute");

		if(flute){

		    try{

        		this.applySettings(

            		JSON.parse(

                		atob(

                    		decodeURIComponent(
                        		flute
                   		 )
              		  )
           		 )
       		 );

   		 }catch(e){

      		  console.error(e);
   		 }
		}
    }

    /**
     * Binds event listeners to form elements.
     * @private
     */
    _bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.calculateAllPositions();
        });

        // Use 'input' event for immediate feedback on temp/unit changes
        this.tempInput.addEventListener('change', () => this._handleTemperatureChange());
        this.tempUnitSelect.addEventListener('change', () => this._handleTemperatureChange());
		this.a4FrequencyInput.addEventListener('change', () => {
    		this.A4_FREQUENCY_HZ = Number(this.a4FrequencyInput.value) || 440.0;
    		this.updateFrequenciesFromKey();
		});
        this.unitInputs.forEach(input => {
            input.addEventListener('change', () => this._handleUnitChange());
        });

        document.querySelectorAll('.hole-row').forEach(row => {
            const index = Number(row.dataset.holeIndex);

            // Frequency checks
            this.holeFrequencyInputs[index].addEventListener('change', (e) => {
                    const value = Number(e.target.value);
                if (value <= 65.41) {
                    e.target.value = 65.41;
                }
                if (value >= 2637) {
                    e.target.value = 2637;
                }
            this.calculateAllPositions();

                const noteEl = document.getElementById(`note${index + 1}`);
                if (noteEl) {
                    noteEl.value = this.frequencyToNoteName(Number(e.target.value));
                }
            });

            // Diameters checks
            this.holeDiameterInputs[index].addEventListener('change', (e) => {
                const value = Number(e.target.value);
                if (value >= Number(this.boreDiameterInput.value)) {
                    e.target.value = Number(this.boreDiameterInput.value - this.wallThickness);
                }
                this.calculateAllPositions();
            });
        });
        //this.keySelector.addEventListener('change', () => this.updateFrequenciesFromKey());
            this.keySelector.addEventListener('change', () => this.updateFrequenciesFromKey());
            this.intervalSequenceInput.addEventListener('change', () => this.updateFrequenciesFromKey());
            this.scalePresetSelect.addEventListener('change', () => {
                const value = this.scalePresetSelect.value;
                    if (value) {
                    this.intervalSequenceInput.value = value;
                    this.updateFrequenciesFromKey();
                    }
                });
            this.intervalSequenceInput.addEventListener('input', () => this.updateFrequenciesFromKey());

            this.embouchureDiameterInput.addEventListener('change', (e) => {
            if (Number(e.target.value) >= Number(this.boreDiameterInput.value)) {
                e.target.value = (Number(this.boreDiameterInput.value) - this.wallThickness);
            }
            this.calculateAllPositions();
        });
        // Force all diameters to be errored if bore diameter is bigger than holes diameters.
        this.boreDiameterInput.addEventListener('change', (e) => {
            // Lecture correcte avec le parseur de fractions
            const newBore = this.parseFraction(e.target.value);
            if (isNaN(newBore) || newBore <= 0) {
                e.target.style.borderColor = 'red';
                return;
            }
            e.target.style.borderColor = '';
            this.boreDiameter = newBore;

            const wall = this.parseFraction(this.wallThicknessInput.value) || 0;

            // Embouchure
            const embVal = this.parseFraction(this.embouchureDiameterInput.value);
            if (!isNaN(embVal) && embVal >= this.boreDiameter) {
                this.embouchureDiameterInput.value = this.decimalToFraction32(this.boreDiameter - wall).replace('"', '');
            }

            // Trous
            this.holeDiameterInputs.forEach(input => {
                const diam = this.parseFraction(input.value);
                if (!isNaN(diam) && diam >= this.boreDiameter) {
                    input.value = this.decimalToFraction32(this.boreDiameter - wall).replace('"', '');
                }
            });

            this.calculateAllPositions();
        });

        // Reset handling
        this.resetButton.addEventListener('click', () => {
            // Note: type="reset" does basic reset. We might want custom default logic here
            // For now, rely on browser reset and then re-init state
            setTimeout(() => {
                try {
                    this.readInputsFromForm();
                } catch {
                    // Fail gracefully: we're resetting things, after all
                }
                this.updateSpeedOfSoundDisplay();
                this.updateFrequenciesFromKey(); // Ensure frequencies match reset key
                this.clearResults();
            }, 0); // Allow form reset to happen first
        });

        this.printButton.addEventListener('click', () => {
            this.printImage();
        });
		this.reportButton.addEventListener('click', ()=>{
        	this.printReport();
    	});
		this.saveFluteButton.addEventListener('click',()=>this.saveFlute());
		this.loadFluteButton.addEventListener('click',()=>this.loadFlute());
		//this.exportJsonButton.addEventListener('click',()=>this.exportJson());
		//this.importJsonButton.addEventListener('click',()=>this.jsonFileInput.click());
		this.shareUrlButton.addEventListener('click',()=>this.generateShareUrl());
		this.jsonFileInput.addEventListener('change',(e)=>this.importJson(e));
        // === Wedge de Fajardo ===
        if (this.fajardoWedgeCheckbox) {
            this.fajardoWedgeCheckbox.addEventListener('change', () => this.calculateAllPositions());
        }
        if (this.wedgeIntensityInput) {
            this.wedgeIntensityInput.addEventListener('input', (e) => {
                if (this.wedgeValueDisplay) {
                    this.wedgeValueDisplay.textContent = e.target.value + ' %';
                }
                this.calculateAllPositions();
            });
        }
    }

    /** Handles changes in the temperature input or units. */
    _handleTemperatureChange() {
        this.readTemperatureInput();
        this.updateSpeedOfSoundDisplay();
        // Maybe trigger recalculation or just update display
        // this.calculateAllPositions(); // Uncomment to auto-recalculate
    }

    /** Handles changes in the unit selection. */
    _handleUnitChange() {
        this.readUnitsInput();
        this.calculateSpeedOfSound();
        this.updateSpeedOfSoundDisplay();
        this.updateUnitsBasedInputs();
        // Potentially convert existing values if needed, or require re-input/recalc
        this.clearResults(); // Clear old results as they are likely invalid
    }

    /** updateUnitsBasedInputs() {
        const isCm = this.units === 'cm';
        const ratio = (isCm ? (1 / this.CM_TO_INCH) : this.CM_TO_INCH);
        const digits = isCm ? 2 : 3;
        this.wallThicknessInput.value = (Number(this.wallThicknessInput.value) * ratio).toFixed(digits);
        this.boreDiameterInput.value = (Number(this.boreDiameterInput.value) * ratio).toFixed(digits);
        this.embouchureDiameterInput.value = (Number(this.embouchureDiameterInput.value) * ratio).toFixed(digits);
        for (let i = 0; i < this.HOLE_COUNT; i++) {
            this.holeDiameterInputs[i].value = (Number(this.holeDiameterInputs[i].value) * ratio).toFixed(digits);
        }
    } */
    
    updateUnitsBasedInputs() {
        const isCm = this.units === 'cm';
        const ratio = isCm ? (1 / this.CM_TO_INCH) : this.CM_TO_INCH;

        // Fonction locale pour formater selon l'unité
            const formatValue = (val) => {
            const num = this.parseFraction(val) * ratio;
            if (isCm) {
                // En cm → décimal avec 2 chiffres
                return num.toFixed(2);
            } else {
                // En pouces → fraction
                return this.decimalToFraction32(num).replace('"', '');
            }
        };

        this.wallThicknessInput.value = formatValue(this.wallThicknessInput.value);
        this.boreDiameterInput.value = formatValue(this.boreDiameterInput.value);
        this.embouchureDiameterInput.value = formatValue(this.embouchureDiameterInput.value);

        for (let i = 0; i < this.HOLE_COUNT; i++) {
            this.holeDiameterInputs[i].value = formatValue(this.holeDiameterInputs[i].value);
        }
    }

    /**
     * Reads all input values from the form into the calculator's state.
     * Performs basic validation.
     *
     * @throws {Error} If at least one input is invalid.
     */
    readInputsFromForm() {
        const criticalErrors = [];
        const holeErrors = [];

        this.readUnitsInput();
        this.readTemperatureInput();

        const parseAndValidate = (inputElement, propertyName, displayName, isPositive = true) => {
            const value = this.parseFraction(inputElement.value);
            if (isNaN(value) || (isPositive && value <= 0)) {
                inputElement.style.borderColor = 'red';
                criticalErrors.push(displayName);
                this[propertyName] = NaN;
            } else {
                inputElement.style.borderColor = '';
                this[propertyName] = value;
            }
        };

        parseAndValidate(this.boreDiameterInput, 'boreDiameter', 'Diamètre intérieur');
        parseAndValidate(this.wallThicknessInput, 'wallThickness', 'Épaisseur de paroi');
        parseAndValidate(this.embouchureDiameterInput, 'embouchureDiameter', 'Diamètre embouchure');
        parseAndValidate(this.endFrequencyInput, 'endFrequency', 'Fréquence de base');

        // --- Trous (erreurs non bloquantes) ---
        this.holes = [];
        for (let i = 0; i < this.activeHoleCount; i++) {
            const freqInput = this.holeFrequencyInputs[i];
            const diamInput = this.holeDiameterInputs[i];
            const freq = parseFloat(freqInput.value);
            const diam = this.parseFraction(diamInput.value);

            let holeValid = true;

            if (isNaN(freq) || freq <= 0) {
                freqInput.style.borderColor = 'red';
                holeValid = false;
                holeErrors.push(`Fréquence du trou ${i + 1}`);
            } else {
                freqInput.style.borderColor = '';
            }

            if (isNaN(diam) || diam <= 0) {
                diamInput.style.borderColor = 'red';
                holeValid = false;
                holeErrors.push(`Diamètre du trou ${i + 1}`);
            } else {
                diamInput.style.borderColor = '';
            }

            this.holes[i] = {
                frequency: holeValid ? freq : NaN,
                diameter: holeValid ? diam : NaN,
                acousticPosition: NaN,
                physicalPosition: NaN,
            };
        }

        // Message discret pour les trous
        this.showStatusMessage(holeErrors);

        // Seulement les erreurs critiques bloquent vraiment
        if (criticalErrors.length > 0) {
            throw new Error("Paramètres globaux invalides : " + criticalErrors.join(', '));
        }
    }

    /** Reads the selected unit system from the radio buttons. */
    readUnitsInput() {
        const selectedUnit = document.querySelector('input[name="units"]:checked');
        this.units = selectedUnit ? selectedUnit.value : 'inches'; // Default to inches if none selected
    }

    /** Reads temperature value and unit, stores temperature in Celsius. */
    readTemperatureInput() {
        const tempValue = parseFloat(this.tempInput.value);
        const tempUnit = this.tempUnitSelect.value;

        if (isNaN(tempValue)) {
            // Force invalid values to be reset
            this.temperatureCelsius = tempUnit === 'F' ? 68 : 20; // Default on error
            console.error(`Invalid temperature input "${tempValue}". Resetting to ${this.temperatureCelsius}`);
        } else {
            this.tempInput.style.borderColor = '';
        }

        if (tempUnit === 'F') {
            this.temperatureCelsius = (tempValue - 32) * 5 / 9;
        } else {
            this.temperatureCelsius = tempValue;
        }
        this.calculateSpeedOfSound(); // Update speed of sound whenever temp changes
    }

    /**
     * Calculates the speed of sound based on temperature and selected units.
     * Formula: V = 331.3 * sqrt(1 + TempC / 273.15) m/s
     */
    calculateSpeedOfSound() {
        const speedOfSoundMps = 331.3 * Math.sqrt(1 + this.temperatureCelsius / 273.15);

        if (this.units === 'cm') {
            this.speedOfSound = speedOfSoundMps * 100; // m/s to cm/s
        } else { // inches
            this.speedOfSound = speedOfSoundMps * 39.3701; // m/s to inches/s
        }
        // Check if speed is valid before updating display
        if (isNaN(this.speedOfSound)) {
            console.error("Could not calculate speed of sound.");
            this.speedOfSoundDisplay.textContent = "Speed of Sound: Error";
            this.speedOfSound = NaN; // Ensure invalid state propagates
        } else {
            this.updateSpeedOfSoundDisplay();
        }

    }

    /** Updates the displayed speed of sound value. */
    updateSpeedOfSoundDisplay() {
		const unitLabel = 
			this.units === "inches"
				? "pouces"
				: "cm";
		
        if (!isNaN(this.speedOfSound)) {
            this.speedOfSoundDisplay.textContent = `Vitesse du Son: ${this.speedOfSound.toFixed(1)} ${unitLabel}/s`;
        } else {
            this.speedOfSoundDisplay.textContent = "Speed of Sound: Calculation Error";
        }
    }
    
    frequencyToNoteName(freq) {
        if (!freq || isNaN(freq) || freq <= 0) return "—";

        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const midi = Math.round(12 * Math.log2(freq / this.A4_FREQUENCY_HZ) + 69);
        const name = noteNames[midi % 12];
        const octave = Math.floor(midi / 12) - 1;

        return name + octave;
    }


    /**
     * Converts a MIDI note number to frequency in Hz.
     * Uses A4 = 440 Hz = MIDI note 69.
     * @param {number} midiNote - The MIDI note number.
     * @returns {number} The frequency in Hz.
     */
    midiNoteToFrequency(midiNote) {
        return this.A4_FREQUENCY_HZ * Math.pow(2, (midiNote - this.MIDI_A4_NOTE) / 12.0);
    }

updateFrequenciesFromKey() {
    const baseMidiNote = parseInt(this.keySelector.value, 10);
    if (isNaN(baseMidiNote)) {
        console.error("Invalid key selected.");
        return;
    }

    // Lire la séquence (ex: "322212")
    const sequenceStr = (this.intervalSequenceInput?.value || "2212221").replace(/\s+/g, "");
    const intervals = sequenceStr.split("").map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);

    // Note de base
    let currentMidi = baseMidiNote;
    this.endFrequencyInput.value = this.midiNoteToFrequency(currentMidi).toFixed(2);

    // Remplir les trous
    for (let i = 0; i < this.HOLE_COUNT; i++) {
        if (i < intervals.length) {
            currentMidi += intervals[i];
            this.holeFrequencyInputs[i].value = this.midiNoteToFrequency(currentMidi).toFixed(2);
        } else {
            this.holeFrequencyInputs[i].value = "";   // laisse vide
        }
    }

    this.activeHoleCount = intervals.length;

    this.updateVisibleHoles();

    // Afficher les noms de notes
    for (let i = 0; i < this.HOLE_COUNT; i++) {
            const noteEl = document.getElementById(`note${i + 1}`);
        if (noteEl) {
            const freq = parseFloat(this.holeFrequencyInputs[i].value);
            noteEl.value = this.frequencyToNoteName(freq);
        }
        // Note de base (fin de flûte)
            const noteEndEl = document.getElementById('noteEnd');
        if (noteEndEl) {
            const baseFreq = parseFloat(this.endFrequencyInput.value);
            noteEndEl.value = this.frequencyToNoteName(baseFreq);
        }
    }
}
    // --- Acoustic Calculation Functions (Ported and Renamed) ---

    /**
     * Calculates the effective wall thickness (height of air column at open hole).
     * Formula: t_e = wall + 0.75 * hole_diameter
     * @param {number} holeIndex - The 0-based index of the hole.
     * @returns {number} The effective thickness in current units. Returns NaN if input invalid.
     */
    updateVisibleHoles() {

        for(let i = 0; i < this.HOLE_COUNT; i++) {

            if(i < this.activeHoleCount) {

                this.holeRows[i].style.display = '';

                this.holeFrequencyInputs[i].required = true;
                this.holeDiameterInputs[i].required = true;

            } else {

                this.holeRows[i].style.display = 'none';

                this.holeFrequencyInputs[i].required = false;
                this.holeDiameterInputs[i].required = false;
            }
        }
    }
    calculateEffectiveHoleHeight(holeIndex) {
        const diameter = this.holes[holeIndex]?.diameter;
        if (isNaN(this.wallThickness) || isNaN(diameter)) return NaN;
        return this.wallThickness + this.HOLE_HEIGHT_EXTENSION_FACTOR * diameter;
    }

    /**
     * Affiche un message de statut discret (non bloquant)
     */
    showStatusMessage(messages = []) {
        let msgEl = document.getElementById('statusMessage');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'statusMessage';
            msgEl.style.cssText = `
                margin: 14px 0;
                padding: 11px 15px;
                border-radius: 8px;
                font-size: 0.93em;
                display: none;
                line-height: 1.4;
            `;
            const table = document.querySelector('table');
            if (table) {
                table.parentNode.insertBefore(msgEl, table);
            }
        }

        if (!messages || messages.length === 0) {
            msgEl.style.display = 'none';
            msgEl.innerHTML = '';
            return;
        }

        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(183, 28, 28, 0.18)';
        msgEl.style.border = '1px solid #c62828';
        msgEl.style.color = '#ffcdd2';
        msgEl.innerHTML = `
            <strong>Attention :</strong> ${messages.join(' • ')}.<br>
            <span style="opacity:0.9">Corrigez les cases en rouge. Les autres trous sont calculés normalement.</span>
        `;
    }

    /**
     * Calcule la fréquence de coupure locale (Benade) pour un trou.
     * @param {number} holeIndex - index 0-based
     * @returns {number} fc en Hz
     */
    calculateCutoffFrequency(holeIndex) {
        if (holeIndex >= this.activeHoleCount || isNaN(this.speedOfSound)) return NaN;

        const hole = this.holes[holeIndex];
        if (!hole || isNaN(hole.diameter) || hole.diameter <= 0) return NaN;

        const a = this.boreDiameter / 2;          // rayon du tube
        const b = hole.diameter / 2;             // rayon du trou
        const te = this.calculateEffectiveHoleHeight(holeIndex);

        // Espacement s = demi-distance au trou suivant (ou à l'extrémité)
        let spacing;
        if (holeIndex + 1 < this.activeHoleCount) {
            const dist = this.holes[holeIndex].physicalPosition - this.holes[holeIndex + 1].physicalPosition;
            spacing = Math.abs(dist) / 2;
        } else {
            spacing = this.holes[holeIndex].physicalPosition / 2;
        }

        if (spacing <= 0 || te <= 0 || a <= 0) return NaN;

        // Formule classique de Benade
        return 0.11 * this.speedOfSound * (b / a) / Math.sqrt(spacing * te);
    }

    /**
     * Colore uniquement la cellule "Distance" de chaque trou
     * selon le ratio fc / (2 × fréquence)
     */
    colorHoleCellsByCutoff() {
        // Couleurs pastel qui restent lisibles sur fond bois sombre
        const colors = [
            { max: 1.10, color: '#ffeb36' }, // Jaune - bas
            { max: 1.35, color: '#c0ca33' }, // Lime
            { max: 1.60, color: '#4fb342' }, // Vert Clair
            { max: 2.10, color: '#2d7e33' }, // Vert – zone idéale
            { max: 2.50, color: '#008982' }, // Teal
            { max: Infinity, color: '#4266b3' } // Bleu – haut
        ];

        for (let i = 0; i < this.HOLE_COUNT; i++) {
            const row = this.holeRows[i];
            if (!row) continue;

            // On cible uniquement la dernière cellule visible (Distance / fraction)
            const cells = row.querySelectorAll('td');
            const distanceCell = cells[cells.length - 1];

            // Réinitialisation
            distanceCell.style.backgroundColor = '';
            distanceCell.title = '';

            if (i >= this.activeHoleCount) continue;

            const freq = this.holes[i]?.frequency;
            const fc = this.calculateCutoffFrequency(i);

            if (isNaN(freq) || isNaN(fc) || freq <= 0) continue;

            const ratio = fc / (2 * freq);

            let bg = colors[colors.length - 1].color;
            for (const c of colors) {
                if (ratio < c.max) {
                    bg = c.color;
                    break;
                }
            }

            distanceCell.style.backgroundColor = bg;
            distanceCell.style.color = '#ffffff';          // texte blanc pour contraste
            distanceCell.style.fontWeight = '600';
            distanceCell.title = `fc ≈ ${Math.round(fc)} Hz  |  ratio = ${ratio.toFixed(2)}`;
        }
    }

    /**
     * Calculates the closed hole correction for a given hole.
     * This length is added for each closed hole above the first open one.
     * Formula: C_c = 0.25 * wall * (hole_diameter / bore_diameter)^2
     * @param {number} holeIndex - The 0-based index of the hole.
     * @returns {number} The closed hole length correction in current units. Returns NaN if input invalid.
     */
    calculateClosedHoleCorrection(holeIndex) {
        const diameter = this.holes[holeIndex]?.diameter;
        if (isNaN(this.wallThickness) || isNaN(diameter) || isNaN(this.boreDiameter) || this.boreDiameter === 0) {
            return NaN;
        }
        const ratio = diameter / this.boreDiameter;
        return 0.25 * this.wallThickness * ratio * ratio;
    }

    /**
     * Calculates the open end correction.
     * Distance from physical end to effective acoustic end.
     * Formula: C_end = 0.6133 * bore_radius
     * @returns {number} The end correction length in current units. Returns NaN if input invalid.
     */
    calculateEndCorrection() {
        if (isNaN(this.boreDiameter)) return NaN;
        return this.END_CORRECTION_FACTOR * (this.boreDiameter / 2.0);
    }

    /**
     * Calculates the effective distance correction for the *first* open tone hole.
     * Uses Benade's formula involving impedance.
     * Formula: C_s = te(1) / ( (D(1)/Bore)^2 + te(1)/(Xend - Xf(1)) )
     * Note: This formula involves Xf(1) which is what we are trying to find, hence the iterative/quadratic approach.
     * This method is primarily for understanding; the quadratic solver incorporates this logic directly.
     * @param {number} acousticLengthX - The target acoustic length for the first hole note (Vsound / (2 * F1)).
     * @param {number} currentGuessXf1 - The current estimate for the first hole's acoustic position.
     * @returns {number} The first hole correction length. Returns NaN if input invalid.
     */
    calculateFirstHoleCorrection_Iterative(acousticLengthX, currentGuessXf1) {
        const holeIndex = 0; // First hole
        const te_1 = this.calculateEffectiveHoleHeight(holeIndex);
        const diameter = this.holes[holeIndex]?.diameter;

        if (isNaN(te_1) || isNaN(diameter) || isNaN(this.boreDiameter) || isNaN(this.acousticEndX) || isNaN(currentGuessXf1) || this.boreDiameter === 0) {
            return NaN;
        }

        const boreRatioSq = (diameter / this.boreDiameter) * (diameter / this.boreDiameter);
        const lengthDiff = this.acousticEndX - currentGuessXf1;

        // Avoid division by zero or near-zero issues
        if (Math.abs(lengthDiff) < 1e-9) return NaN; // Or handle appropriately

        return te_1 / (boreRatioSq + te_1 / lengthDiff);
    }

    /**
     * Calculates the effective distance correction for subsequent open tone holes (lattice correction).
     * Formula: C_o(n) = ((Xf(n-1)-Xf(n))/2) * (sqrt(1 + 4*(te(n)/(Xf(n-1)-Xf(n)))*(Bore/D(n))^2) - 1)
     * Similar to C_s, this depends on Xf(n), making it part of the iterative/quadratic solution.
     * This method is primarily for understanding.
     * @param {number} holeIndex - The 0-based index of the current hole (n >= 1).
     * @param {number} currentGuessXfn - The current estimate for this hole's acoustic position.
     * @returns {number} The subsequent hole correction length. Returns NaN if input invalid.
     */
    calculateSubsequentHoleCorrection_Iterative(holeIndex, currentGuessXfn) {
        if (holeIndex < 1) return NaN; // Only for holes 2 onwards (index 1+)

        const te_n = this.calculateEffectiveHoleHeight(holeIndex);
        const diameter_n = this.holes[holeIndex]?.diameter;
        const prevHolePos = this.holes[holeIndex - 1]?.acousticPosition; // Requires previous hole already calculated

        if (isNaN(te_n) || isNaN(diameter_n) || isNaN(prevHolePos) || isNaN(currentGuessXfn) || isNaN(this.boreDiameter) || diameter_n === 0) {
            return NaN;
        }

        const holeSpacing = prevHolePos - currentGuessXfn;
        // Avoid division by zero or sqrt of negative
        if (Math.abs(holeSpacing) < 1e-9) return NaN;

        const bore_d_ratio_sq = (this.boreDiameter / diameter_n) * (this.boreDiameter / diameter_n);
        const term = 4 * (te_n / holeSpacing) * bore_d_ratio_sq;

        if (1 + term < 0) return NaN; // Avoid sqrt of negative

        return (holeSpacing / 2.0) * (Math.sqrt(1.0 + term) - 1.0);
    }


    /**
     * Calculates the embouchure correction using Kosel's empirical fit.
     * This represents the distance from the theoretical start of the air column to the effective acoustic center of the embouchure.
     * Formula: C_emb = (Bore/Demb)^2 * 10.84 * wall * Demb / (Bore + 2*wall)
     * @returns {number} The embouchure correction length. Returns NaN if input invalid.
     */
    calculateEmbouchureCorrection() {
        if (isNaN(this.boreDiameter) || isNaN(this.embouchureDiameter) || isNaN(this.wallThickness) ||
            this.embouchureDiameter === 0 || (this.boreDiameter + 2 * this.wallThickness) === 0) {
            return NaN;
        }

        const bore_demb_ratio_sq = (this.boreDiameter / this.embouchureDiameter) * (this.boreDiameter / this.embouchureDiameter);
        const numerator = 10.84 * this.wallThickness * this.embouchureDiameter;
        const denominator = this.boreDiameter + 2.0 * this.wallThickness;

        let embouchureCorrection = bore_demb_ratio_sq * numerator / denominator;

        // Application du wedge de Fajardo (si activé)
        const wedgeFactor = this.getFajardoWedgeFactor();
        embouchureCorrection *= wedgeFactor;

        return embouchureCorrection;
    }

    /**
     * Facteur d'ajustement dû au wedge de Fajardo.
     * Approximation empirique : le wedge raccourcit légèrement
     * la correction d'embouchure (améliore surtout le 2e octave).
     * @returns {number} multiplicateur (1.0 = aucun effet)
     */
    getFajardoWedgeFactor() {
        if (!this.fajardoWedgeCheckbox || !this.fajardoWedgeCheckbox.checked) {
            return 1.0;
        }
        const intensity = (this.wedgeIntensityInput ? Number(this.wedgeIntensityInput.value) : 50) / 100;
        // Réduction maximale d'environ 8 % de la correction à intensité 100 %
        return 1.0 - (0.08 * intensity);
    }

    /**
     * Calculates all hole positions using the non-iterative quadratic solution method.
     * Based on Benade's equations after algebraic manipulation.
     * Updates the `acousticPosition` property for each hole and `acousticEndX`, `embouchureAcousticX`.
     * @returns {boolean} True if calculation was successful, false otherwise.
     */
    calculateHolePositions_Quadratic() {
        // Ensure speed of sound is valid
        if (isNaN(this.speedOfSound) || this.speedOfSound <= 0) {
            console.error("Cannot calculate positions: Invalid speed of sound.");
            return false;
        }

        // 0. Preliminary calculations and validation
        let closedHoleCorrections = [];
        for (let i = 0; i < this.activeHoleCount; i++) {
            const chc = this.calculateClosedHoleCorrection(i);
            if (isNaN(chc)) {
                console.error(`Cannot calculate positions: Invalid input for closed hole correction ${i + 1}.`);
                return false;
            }
            closedHoleCorrections[i] = chc;
        }

        const endCorrection = this.calculateEndCorrection();
        if (isNaN(endCorrection)) {
            console.error("Cannot calculate positions: Invalid input for end correction.");
            return false;
        }

        // 1. Calculate effective acoustic end position (Xend)
        // Raw length based on fundamental frequency
        if (isNaN(this.endFrequency) || this.endFrequency <= 0) {
            console.error("Cannot calculate positions: Invalid end frequency.");
            return false;
        }
        let targetAcousticLengthEnd = this.speedOfSound * 0.5 / this.endFrequency;
        // Apply corrections
        this.acousticEndX = targetAcousticLengthEnd - endCorrection;
        for (let i = 0; i < this.activeHoleCount; i++) {
            this.acousticEndX -= closedHoleCorrections[i];
        }
        if (isNaN(this.acousticEndX)) {
            console.error("Calculation failed: Acoustic End Position is NaN.");
            return false;
        }

        // 2. Calculate first finger hole position (Xf[0] or Xf(1) in original)
        const holeIndex1 = 0;
        const te_1 = this.calculateEffectiveHoleHeight(holeIndex1);
        const diameter1 = this.holes[holeIndex1].diameter;
        const freq1 = this.holes[holeIndex1].frequency;
        if (isNaN(te_1) || isNaN(diameter1) || isNaN(freq1) || freq1 <= 0) {
            console.error("Cannot calculate positions: Invalid input for hole 1.");
            return false;
        }

        let L1 = this.speedOfSound * 0.5 / freq1;
        // Subtract corrections for *closed* holes above hole 1 (i.e., holes 2 to N)
        for (let i = holeIndex1 + 1; i < this.activeHoleCount; i++) {
            L1 -= closedHoleCorrections[i];
        }
        if (isNaN(L1)) {
            console.error("Calculation failed: L1 is NaN.");
            return false;
        }

        // Quadratic solution for Xf[0] derived from Benade's impedance matching
        const a1_term = (diameter1 / this.boreDiameter) * (diameter1 / this.boreDiameter);
        const a1 = a1_term;
        const b1 = -(this.acousticEndX + L1) * a1_term;
        const c1 = this.acousticEndX * L1 * a1_term + te_1 * (L1 - this.acousticEndX);

        const discriminant1 = (b1 * b1) - 4 * a1 * c1;
        if (discriminant1 < 0 || a1 === 0) {
            console.error("Calculation failed: Cannot solve quadratic for hole 1 (discriminant < 0 or a=0).", { a1, b1, c1, discriminant1 });
            this.holeDiameterInputs[0].style.borderColor = 'red';
            return false;
        }
        this.holeDiameterInputs[0].style.borderColor = '';
        // We expect Xf[0] < L1 and Xf[0] < Xend. The solution using the minus sign usually yields the physically correct result.
        this.holes[holeIndex1].acousticPosition = (-b1 - Math.sqrt(discriminant1)) / (2 * a1);
        if (isNaN(this.holes[holeIndex1].acousticPosition)) {
            console.error("Calculation failed: Acoustic position for hole 1 is NaN.");
            return false;
        }


        // 3. Calculate subsequent finger hole positions (Xf[1] to Xf[N-1])
        for (let n = 1; n < this.activeHoleCount; n++) { // n is the current hole index (0-based)
            const te_n = this.calculateEffectiveHoleHeight(n);
            const diameter_n = this.holes[n].diameter;
            const freq_n = this.holes[n].frequency;
            console.log(
                "n=",
                n,
                "holes=",
                this.holes
            );
            const prevHolePos = this.holes[n - 1].acousticPosition; // Xf[n-1]

            if (isNaN(te_n) || isNaN(diameter_n) || isNaN(freq_n) || freq_n <= 0 || isNaN(prevHolePos)) {
                console.error(`Calculation failed: Invalid input for hole ${n + 1}.`);
                return false;
            }

            let Ln = this.speedOfSound * 0.5 / freq_n;
            // Subtract corrections for closed holes above hole n (i.e., holes n+1 to N)
            for (let i = n + 1; i < this.activeHoleCount; i++) {
                Ln -= closedHoleCorrections[i];
            }
            if (isNaN(Ln)) {
                console.error(`Calculation failed: Ln for hole ${n + 1} is NaN.`);
                return false;
            }

            // Quadratic solution for Xf[n], derived from Benade's lattice correction formula
            // Rearranging C_o(n) = Xf[n-1] - Xf[n] - Ln leads to a quadratic in Xf[n]
            // Original formula: C_o(n) = ((Xf[n-1]-Xf[n])/2)*(sqrt(1+4*(te(n)/(Xf(n-1)-Xf[n]))*(Bore/D(n))^2)-1)
            // Substitute C_o(n) = Xf[n-1] - Xf[n] - Ln and solve for Xf[n].
            // The provided quadratic coefficients in the original code were:
            // a = 2;
            // b = - Xf[n-1] - 3*L + te(n)*(Bore/D(n))^2;
            // c = Xf[n-1]*(L - te(n)*(Bore/D(n))^2) + (L*L);
            // Let's re-verify or trust the original derivation for now.
            if (diameter_n === 0) {
                console.error(`Calculation failed: Diameter for hole ${n + 1} cannot be zero.`);
                return false;
            }
            const bore_d_ratio_sq = (this.boreDiameter / diameter_n) * (this.boreDiameter / diameter_n);
            const a_n = 2.0;
            const b_n = -prevHolePos - 3.0 * Ln + te_n * bore_d_ratio_sq;
            const c_n = prevHolePos * (Ln - te_n * bore_d_ratio_sq) + (Ln * Ln);

            const discriminant_n = (b_n * b_n) - 4.0 * a_n * c_n;
            if (discriminant_n < 0) {
                console.error(`Calculation failed: Cannot solve quadratic for hole ${n + 1} (discriminant < 0).`, { a_n, b_n, c_n, discriminant_n });
                this.holeDiameterInputs[n-1].style.borderColor = 'red';
                return false;
            }
            this.holeDiameterInputs[n-1].style.borderColor = '';
            // Expect Xf[n] < Ln and Xf[n] < Xf[n-1]. The minus sign solution is typically correct.
            this.holes[n].acousticPosition = (-b_n - Math.sqrt(discriminant_n)) / (2.0 * a_n);
            if (isNaN(this.holes[n].acousticPosition)) {
                console.error(`Calculation failed: Acoustic position for hole ${n + 1} is NaN.`);
                return false;
            }
        }

        // 4. Calculate embouchure effective acoustic location (Xemb)
        this.embouchureAcousticX = this.calculateEmbouchureCorrection();
        if (isNaN(this.embouchureAcousticX)) {
            console.error("Calculation failed: Embouchure correction is NaN.");
            return false;
        }

        // 5. Calculate physical positions relative to the open end
        // Physical Distance = Acoustic End Position - Acoustic Position of Hole/Embouchure
        if (isNaN(this.acousticEndX)) {
            console.error("Calculation failed: Cannot determine physical positions due to invalid Acoustic End Position.");
            return false;
        }
        this.embouchurePhysicalPosition = this.acousticEndX - this.embouchureAcousticX;
        for (let i = 0; i < this.activeHoleCount; i++) {
            this.holes[i].physicalPosition = this.acousticEndX - this.holes[i].acousticPosition;
            if (isNaN(this.holes[i].physicalPosition)) {
                console.error(`Calculation failed: Physical position for hole ${i + 1} is NaN.`);
                return false; // Stop if any calculation fails
            }
        }

        return true; // Indicate success
    }

    /**
     * Performs the full calculation pipeline: read inputs, calculate, display results.
     */
    calculateAllPositions() {
        console.log("calculateAllPositions()");
        console.log("activeHoleCount = ", this.activeHoleCount);

        try {
            this.readInputsFromForm();
            const success = this.calculateHolePositions_Quadratic();
            this.displayResultsInForm();
            this.renderFluteImage();

            if (!success) {
                // Le message est déjà géré par showStatusMessage
            }
        } catch (e) {
            // Erreurs critiques seulement
            this.showStatusMessage([e.message]);
            this.clearResults();
            this.clearFluteImage();
        }
    }

    /**
     * Displays the calculated physical positions in the output fields.
     */
    displayResultsInForm() {
        const format = (value) => isNaN(value) ? "—" : value.toFixed(3);

        this.resultEmbouchureOutput.value = format(this.embouchurePhysicalPosition);
        this.resultEmbouchureFractionOutput.value = isNaN(this.embouchurePhysicalPosition)
            ? "—"
            : this.decimalToFraction32(this.embouchurePhysicalPosition);
        this.resultEndOutput.value = "0.000";

        for (let i = 0; i < this.HOLE_COUNT; i++) {
            if (this.holeResultOutputs[i]) {
                const pos = this.holes[i]?.physicalPosition;
                this.holeResultOutputs[i].value = format(pos);
                this.holeFractionOutputs[i].value = isNaN(pos)
                    ? "—"
                    : this.decimalToFraction32(pos);
            }
        }

        this.colorHoleCellsByCutoff();
    }
    
    

    clearFluteImage() {
        const canvas = this.renderedFluteElement;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * Displays an illustration of the flute itself.
     */
    renderFluteImage() {
        const canvas = this.renderedFluteElement;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        const isCm = this.units === 'cm';
        const digits = isCm ? 2 : 3;
		const unitLabel = 
			this.units === "inches"
				? "po"
				: "cm";
        const xPadding = 0;
        const fluteEndX = canvas.width - xPadding;
        const rawMaxCorkLength = this.embouchureDiameter * 1.5;
        const rawFluteLength = this.getRawFluteLength();
        const displayFluteLength = (canvas.width - xPadding * 2);
        const displayRatio = displayFluteLength / rawFluteLength;
        const displayWallThickness = Math.floor(this.wallThickness * displayRatio);
        const displayBoreDiameter = Math.floor(this.boreDiameter * displayRatio);
        const spaceBetweenMeasurementLines = 40;
        const fluteMarginY = spaceBetweenMeasurementLines * 2;
        const measurementLinesBaseY = fluteMarginY + displayWallThickness + displayBoreDiameter;
        const rawMinCorkLength = this.embouchureDiameter;
        const minCorkLength = rawMinCorkLength * displayRatio;
        const maxCorkLength = rawMaxCorkLength * displayRatio;
        const centerFluteY = fluteMarginY + displayWallThickness + displayBoreDiameter / 2;

        canvas.height = measurementLinesBaseY + (this.HOLE_COUNT + 2) * spaceBetweenMeasurementLines + xPadding;

        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.setLineDash([]);
        context.fillStyle = 'black';
        context.strokeStyle = 'red';
        context.lineWidth = 1;

        // Small arcs under the flute's shape, as indicators
        //{
        //    const numberOfArcs = 100;

        //    context.strokeStyle = '#dddddd';
            // context.strokeStyle = 'red';

        //    for (let i = 1; i <= numberOfArcs; i++) {
        //        const arcX = maxCorkLength * 1.5 + Math.floor(i * (displayFluteLength) / numberOfArcs);
        //        context.beginPath();
        //        context.arc(arcX, centerFluteY, displayBoreDiameter / 2, Math.PI * 0.5, Math.PI * 1.5);
        //        context.stroke();
        //    }
        //}
        

        // Draw flute's outer shape
        {
            context.strokeStyle = '#5d4037';
            
            // Dégradé intérieur du tube
            const boreGradient = context.createLinearGradient(
                0, 
                fluteMarginY + displayWallThickness, 
                0, 
                fluteMarginY + displayWallThickness + displayBoreDiameter
            );
            boreGradient.addColorStop(0, '#5d4037');      // foncé en haut
            boreGradient.addColorStop(0.5, '#d7ccc8');    // clair au milieu
            boreGradient.addColorStop(1, '#5d4037');      // foncé en bas

            context.fillStyle = boreGradient;
            context.fillRect(
                fluteEndX - displayFluteLength, 
                fluteMarginY + displayWallThickness, 
                displayFluteLength, 
                displayBoreDiameter
            );

            // Top flute line
            context.fillRect(fluteEndX - displayFluteLength, fluteMarginY, displayFluteLength, displayWallThickness);
            // Bottom flute line
            const bottomY = fluteMarginY + displayWallThickness + displayBoreDiameter
            context.fillRect(fluteEndX - displayFluteLength, bottomY, displayFluteLength, displayWallThickness);
            // Closed end
            context.fillRect(xPadding, fluteMarginY, 1, displayWallThickness);

            // Closed end / cork
            // Reminder:
            // Cork length is between 1 and 1.5 times the embouchure diameter.
            // There's a color for the minimum size, and another for the maximum size.
            context.lineWidth = 1;
            const corkDiameter = displayBoreDiameter;
            const corkStartX = xPadding;
            context.fillStyle = '#dbc0b6';
            context.fillRect(corkStartX, fluteMarginY + displayWallThickness, maxCorkLength, corkDiameter);
            context.fillStyle = '#ba8761';
            context.fillRect(corkStartX, fluteMarginY + displayWallThickness, minCorkLength, corkDiameter);
			context.fillStyle = 'black';
			context.font = '14px Verdana';

			context.fillText('Bouchon : 1× à 1.5× Ø embouchure à partir du centre', maxCorkLength + 20, fluteMarginY - 20);
			
        }

        // Draw measurement indicators and lines
        {
            function drawMeasurementLine(inputValue, yPosition, text, inversePosition) {
                inversePosition = !!inversePosition;
                const distanceFromEnd = Number(inputValue) * displayRatio;
                const lineLengthFromEnd = fluteEndX - distanceFromEnd;

                // Horizontal line
                context.beginPath();
                context.setLineDash([]);
                context.moveTo(inversePosition ? xPadding : fluteEndX, yPosition);
                context.lineTo(lineLengthFromEnd, yPosition);
                context.stroke();
                // Vertical dotted line
                context.beginPath();
                context.setLineDash([2, 5]);
                context.moveTo(lineLengthFromEnd, Math.floor(fluteMarginY + displayBoreDiameter / 2));
                context.lineTo(lineLengthFromEnd, yPosition);
                context.stroke();
                context.setLineDash([]);
                // Measure indication
                const minFontSize = 3;
                let fontSize = 15;
                context.font = fontSize.toString() + "px Verdana";
                context.fillStyle = 'black';
                context.textAlign = 'left';
                const spaceAroundLine = 10;
                function measureText(text) {
                    const measure = context.measureText(text);
                    measure.height = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent;
                    return measure;
                }
                while (measureText(text).width > distanceFromEnd) {
                    fontSize--;
                    if (fontSize < minFontSize) {
                        // Don't display units if size is too small
                        break;
                    }
                    context.font = fontSize.toString() + "px Verdana";
                }
                while ((measureText(text).height + (spaceAroundLine * 2)) > spaceBetweenMeasurementLines) {
                    fontSize--;
                    if (fontSize < minFontSize) {
                        // Don't display units if size is  too small
                        break;
                    }
                    context.font = fontSize.toString() + "px Verdana";
                }
                context.fillText(text, inversePosition ? xPadding : (fluteEndX - distanceFromEnd + spaceAroundLine), yPosition - spaceAroundLine);
            }

            context.fillStyle = 'transparent';
            context.strokeStyle = '#666666';
            context.lineWidth = 1;

            // Vertical line from open end to last line at the bottom
            context.beginPath();
            context.setLineDash([2, 5]);
            context.moveTo(fluteEndX, xPadding);
            context.lineTo(fluteEndX, measurementLinesBaseY + Math.floor(this.HOLE_COUNT * spaceBetweenMeasurementLines));
            context.stroke();

            // Flute length measurement
            //drawMeasurementLine(rawFluteLength, measurementLinesBaseY + spaceBetweenMeasurementLines * (this.HOLE_COUNT + 2), `Longueur de la flûte: ${rawFluteLength.toFixed(digits)} ${unitLabel}`);
			const unitLabel =
    			this.units === "inches"
      				? "po"
        			: "cm";
            // Holes measurements
			const embFraction = this.decimalToFraction32(Number(this.resultEmbouchureOutput.value));

			const embDiamFraction = this.decimalToFraction32(this.embouchureDiameter);
			
            drawMeasurementLine(this.resultEmbouchureOutput.value, measurementLinesBaseY + spaceBetweenMeasurementLines * (this.HOLE_COUNT + 1), `Embouchure: ${embFraction} ; Ø ${embDiamFraction}`);
            for (let i = 0; i < this.HOLE_COUNT; i++) {
						const length =
    						this.decimalToFraction32(
       						Number(
        						    this.holeResultOutputs[i].value
    							  )
   						);

						const diameter =
                                this.decimalToFraction32(
                                this.parseFraction(this.holeDiameterInputs[i].value)
                                );
                drawMeasurementLine(Number(this.holeResultOutputs[i].value), measurementLinesBaseY + spaceBetweenMeasurementLines * (i + 1), `${length} ; Ø ${diameter}`
);
            }

            // Cork measurements
			const minCorkFraction =
    				this.decimalToFraction32(
        				rawMinCorkLength
    				);

			const maxCorkFraction =
    				this.decimalToFraction32(
        				rawMaxCorkLength
    				);
			
            //drawMeasurementLine(rawFluteLength - rawMinCorkLength / 2, measurementLinesBaseY - spaceBetweenMeasurementLines, `Longueur min du bouchon: ${minCorkFraction}`, true);
            //drawMeasurementLine(rawFluteLength - rawMinCorkLength * 1.25, measurementLinesBaseY - spaceBetweenMeasurementLines * 2, `Longueur max du bouchon: ${maxCorkFraction}`, true);
        }

        // Hole measurements
        {
            context.fillStyle = 'black';
            context.strokeStyle = 'black';
            context.lineWidth = 1;

            for (let i = 0; i < this.HOLE_COUNT; i++) {
                const distanceFromEnd = this.holeResultOutputs[i].value * displayRatio;
                const xPosition = fluteEndX - distanceFromEnd;
                //const holeRadius = this.holeDiameterInputs[i].value * displayRatio / 2;
                const holeRadius = this.parseFraction(this.holeDiameterInputs[i].value) * displayRatio / 2;
                context.beginPath();
                context.arc(xPosition, centerFluteY, holeRadius, 0, Math.PI * 2);
                context.fill();
            }
        }

        // Draw holes
        {
            function drawHole(rawDistanceFromEnd, diameter) {
                const distanceFromEnd = rawDistanceFromEnd * displayRatio;
                const xPosition = fluteEndX - distanceFromEnd;
                const holeRadius = diameter * displayRatio / 2;

                context.fillStyle = 'black';
                context.strokeStyle = 'black';

                context.beginPath();
                context.arc(xPosition, centerFluteY, holeRadius, 0, Math.PI * 2);
                context.fill();

                context.fillStyle = 'white';
                context.strokeStyle = 'white';
                context.beginPath();
                context.moveTo(xPosition - 4, centerFluteY);
                context.lineTo(xPosition + 4, centerFluteY);
                context.stroke();
                context.beginPath();
                context.moveTo(xPosition, centerFluteY - 4);
                context.lineTo(xPosition, centerFluteY + 4);
                context.stroke();

            }

            context.lineWidth = 1;

            //for (let i = 0; i < this.HOLE_COUNT; i++) {
            //    drawHole(this.holeResultOutputs[i].value, this.holeDiameterInputs[i].value);
            //}
            //drawHole(this.resultEmbouchureOutput.value, this.embouchureDiameter);
            for (let i = 0; i < this.HOLE_COUNT; i++) {
                drawHole(this.holeResultOutputs[i].value, this.parseFraction(this.holeDiameterInputs[i].value));
            }
            drawHole(this.resultEmbouchureOutput.value, this.embouchureDiameter);
        }
    }

    /**
     * Of course, it could be just "this.embouchureDiameter * 2.5",
     * but at least there's an explanation on why we have these numbers.
     * Clarity over efficiency is better here :)
     *
     * @returns {number}
     */
    getRawFluteLength() {
        return Number(this.resultEmbouchureOutput.value) // Raw embouchure distance
            + Number(this.embouchureDiameter / 2) // Embouchure itself
            + Number(this.embouchureDiameter * 1.5) // Raw max cork length
            + Number(this.embouchureDiameter / 2) // Raw gap between closed end and cork
        ;
    }

    printImage() {
        const rawFluteLength = this.getRawFluteLength();
        const cssUnit = this.units.substring(0, 2); // "cm" or "in"
        const imageWidth = `${rawFluteLength.toFixed(2)}${cssUnit}`;
        const imageDataUrl = this.renderedFluteElement.toDataURL();

        const pageMarginMm = 5;
        const a4LandscapeWidthMm = 297;
        const printableWidthMm = a4LandscapeWidthMm - 2 * pageMarginMm;
        const printableWidth = cssUnit === 'cm'
            ? printableWidthMm / 10 // Metric system
            : printableWidthMm / 25.4 // Imperial system
        ;
        const pageCount = Math.ceil(rawFluteLength / printableWidth);

        let segmentsHtml = '';
        for (let i = 0; i < pageCount; i++) {
            const offset = i * printableWidth;
            const pageBreak = i < pageCount - 1 ? 'page-break-after: always;' : '';
            segmentsHtml += `
                <div class="segment" style="${pageBreak}">
                    <img src="${imageDataUrl}" alt="Flute Diagram (part ${i + 1}/${pageCount})"
                         style="margin-left: -${offset.toFixed(4)}${cssUnit};">
                </div>
            `;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>Flute Diagram</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }
                    body {
                        margin: ${pageMarginMm}mm;
                        padding: 0;
                    }
                    .segment {
                        width: ${printableWidth.toFixed(4)}${cssUnit};
                        overflow: hidden;
                    }
                    .segment img {
                        display: block;
                        width: ${imageWidth};
                        height: auto;
                    }
                </style>
            </head>
            <body>
                ${segmentsHtml}
            </body>
            </html>
        `);
        printWindow.document.close();

        printWindow.document.querySelector('img').onload = () => {
            printWindow.print();
        };
    }
	
	printReport() {

    const imageDataUrl = this.renderedFluteElement.toDataURL();
    const fluteName = document.getElementById("fluteName")?.value || "Unnamed flute";
    const notes = document.getElementById("notes")?.value || "";
    const today = new Date().toLocaleString();
    
    let holeTable = "";
    // Boucle inversée : 6 en haut → 1 en bas
    for (let i = this.activeHoleCount - 1; i >= 0; i--) {
        const note = this.frequencyToNoteName(parseFloat(this.holeFrequencyInputs[i].value));
        holeTable += `
        <tr>
            <td>${i + 1}</td>
            <td>${note}</td>
            <td>${this.holeFrequencyInputs[i].value}</td>
            <td>${this.holeDiameterInputs[i].value}</td>
            <td>${this.decimalToFraction32(Number(this.holeResultOutputs[i].value))}</td>
            </tr>
        `;
    }

    const printWindow = window.open("", "_blank");

    printWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<title>${fluteName}</title>

<style>

@page{
    size:A4 landscape;
    margin:10mm;
}

body{
    font-family:Arial,sans-serif;
}

h1{
    margin-bottom:5px;
}

.info{
    margin-bottom:10px;
}

.notes{
    border:1px solid #888;
    padding:10px;
    min-height:80px;
    white-space:pre-wrap;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-top:10px;
}

th,td{
    border:1px solid #aaa;
    padding:4px;
}

img{
	width:100%;
	max-height:400px;
	object-fit:contain;
	border:1px solid #aaa;
}

</style>

</head>

<body>

<h1>${fluteName}</h1>

<div class="info">

<b>Date:</b> ${today}<br>

<b>Diamètre interne du Tube:</b> ${this.boreDiameter}<br>

<b>Épaisseur du Mur:</b> ${this.wallThickness}<br>

<b>Embouchure:</b> ${this.embouchureDiameter}<br>

<b>Unités:</b> ${
    this.units === "inches"
        ? "pouces"
        : "cm"
}

</div>

<h2>Notes</h2>

<div class="notes">
${notes}
</div>

<h2>Hole Data</h2>

<table>

<tr>
<th>Trou</th>
<th>Note</th>
<th>Fréquence</th>
<th>Diamètre</th>
<th>Position</th>
</tr>

${holeTable}

</table>

<br><br>
		
<br><br>

<br><br>
		
<h2>Dessin de la flûte</h2>

<h1>${fluteName}</h1>

<div class="info">

<b>Date:</b> ${today}<br>

<b>Diamètre interne du Tube:</b> ${this.boreDiameter}<br>

<b>Épaisseur du Mur:</b> ${this.wallThickness}<br>

<b>Embouchure:</b> ${this.embouchureDiameter}<br>

<b>Unités:</b> ${
    this.units === "inches"
        ? "pouces"
        : "cm"
}

</div>

<br>

<img src="${imageDataUrl}" alt="Flûte"

</body>

</html>

`);

    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.print();
    };
}
	
	getSettings(){

    return{
		
		name:
		document.getElementById("fluteName").value,
		
		date:
		new Date().toLocaleString(),
		
		notes:
		document.getElementById("notes").value,

        units:this.units,

        temperature:this.tempInput.value,
			
        tempUnit:this.tempUnitSelect.value,

        boreDiameter:this.boreDiameterInput.value,

        wallThickness:this.wallThicknessInput.value,

        embouchureDiameter:this.embouchureDiameterInput.value,

        key:this.keySelector.value,

        endFrequency:this.endFrequencyInput.value,

        frequencies:this.holeFrequencyInputs.map(
            x=>x.value
        ),

        diameters:this.holeDiameterInputs.map(
            x=>x.value
        )
    };
}

applySettings(settings){
	
	document.getElementById("fluteName").value=settings.name || "";
	
	document.getElementById("notes").value=settings.notes || "";

    this.tempInput.value=settings.temperature;
    this.tempUnitSelect.value=settings.tempUnit;

    this.boreDiameterInput.value=settings.boreDiameter;
    this.wallThicknessInput.value=settings.wallThickness;
    this.embouchureDiameterInput.value=settings.embouchureDiameter;

    this.keySelector.value=settings.key;
    this.endFrequencyInput.value=settings.endFrequency;

    settings.frequencies.forEach((v,i)=>{
        this.holeFrequencyInputs[i].value=v;
    });

    settings.diameters.forEach((v,i)=>{
        this.holeDiameterInputs[i].value=v;
    });

    this.calculateAllPositions();
}

saveFlute() {
    const name = prompt("Nom de la flûte");
    if (!name) return;

    const data = JSON.stringify(this.getSettings(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = name + ".json";
    a.click();

    URL.revokeObjectURL(url);
    alert("Fichier téléchargé !\nPlace-le dans le même dossier que ton .js si tu veux.");
}

loadFlute() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.applySettings(data);
                alert("Flûte chargée : " + file.name);
            } catch (err) {
                alert("Erreur : fichier JSON invalide");
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

generateShareUrl(){

    const encoded=

        encodeURIComponent(

            btoa(

                JSON.stringify(
                    this.getSettings()
                )
            )
        );

    const url=

        location.origin+
        location.pathname+
        "?flute="+
        encoded;

    navigator.clipboard.writeText(url);

    alert(
        "URL copied to clipboard"
    );
}

parseFraction(value) {
    if (value === null || value === undefined) return NaN;
    value = String(value).trim().replace(',', '.');

    // Déjà un nombre décimal
    if (!isNaN(value) && value !== '') return parseFloat(value);

    // Format "1 1/2" ou "3/8"
    const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
        return parseInt(mixed[1]) + (parseInt(mixed[2]) / parseInt(mixed[3]));
    }

    // Format simple "3/8"
    const simple = value.match(/^(\d+)\/(\d+)$/);
    if (simple) {
        return parseInt(simple[1]) / parseInt(simple[2]);
    }

    return NaN;
}

decimalToFraction32(value){

    const whole = Math.floor(value);

    let numerator =
        Math.round(
            (value - whole) * 32
        );

    let denominator = 32;

    if(numerator === 32){
        return (whole + 1) + '"';
    }

    function gcd(a,b){
        return b ? gcd(b,a%b) : a;
    }

    const div =
        gcd(numerator, denominator);

    numerator /= div;
    denominator /= div;

	if(numerator === 0){
    	return `${whole}"`;
	}

	if(whole === 0){
    	return `${numerator}/${denominator}"`;
	}

	return `${whole} ${numerator}/${denominator}"`;
}

/**
 * Facteur d'ajustement dû au wedge de Fajardo.
 * Approximation empirique.
 */
getFajardoWedgeFactor() {
    if (!this.fajardoWedgeCheckbox || !this.fajardoWedgeCheckbox.checked) {
        return 1.0;
    }
    const intensity = (this.wedgeIntensityInput ? Number(this.wedgeIntensityInput.value) : 50) / 100;
    // Réduction maximale d'environ 8 % à 100 %
    return 1.0 - (0.08 * intensity);
}

    /** Clears all result output fields. */
    clearResults() {
        this.resultEmbouchureOutput.value = "";
        this.resultEndOutput.value = "0.000";
        this.holeResultOutputs.forEach(output => {
            if (output) output.value = "";
        });

        // Nettoyage des couleurs des cellules
        this.holeRows.forEach(row => {
            if (!row) return;
            const cells = row.querySelectorAll('td');
            const distanceCell = cells[cells.length - 1];
            if (distanceCell) {
                distanceCell.style.backgroundColor = '';
                distanceCell.style.color = '';
                distanceCell.style.fontWeight = '';
                distanceCell.title = '';
            }
        });

        // Cache le message d’erreur
        if (typeof this.showStatusMessage === 'function') {
            this.showStatusMessage([]);
        }
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Add polyfill for Number.isNaN if needed for older browsers
    Number.isNaN = Number.isNaN || function (value) {
        return typeof value === 'number' && isNaN(value);
    }
    window.fluteCalculator = new FluteCalculator();
});
