function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var MIN_NOTE = 48;
var MAX_NOTE = 84;

var math = dl.ENV.math;

var forgetBias = dl.Scalar.new(1.0);
var temperature = dl.Scalar.new(1.1);

// Using the Improv RNN pretrained model from https://github.com/tensorflow/magenta/tree/master/magenta/models/improv_rnn
var loader = new dl.CheckpointLoader('https://teropa.info/improv_rnn_pretrained_checkpoint/');
var lstm = void 0;
var rnnLoadPromise = loader.getAllVariables().then(function (vars) {
  lstm = {
    kernel1: vars['RNN/MultiRNNCell/Cell0/BasicLSTMCell/Linear/Matrix'],
    bias1: vars['RNN/MultiRNNCell/Cell0/BasicLSTMCell/Linear/Bias'],
    kernel2: vars['RNN/MultiRNNCell/Cell1/BasicLSTMCell/Linear/Matrix'],
    bias2: vars['RNN/MultiRNNCell/Cell1/BasicLSTMCell/Linear/Bias'],
    kernel3: vars['RNN/MultiRNNCell/Cell2/BasicLSTMCell/Linear/Matrix'],
    bias3: vars['RNN/MultiRNNCell/Cell2/BasicLSTMCell/Linear/Bias'],
    fullyConnectedBiases: vars['fully_connected/biases'],
    fullyConnectedWeights: vars['fully_connected/weights']
  };
});

var reverb = new Tone.Convolver('https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').toMaster();
reverb.wet.value = 0.25;
var sampler = new Tone.Sampler({
  C3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c3.mp3',
  'D#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds3.mp3',
  'F#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs3.mp3',
  A3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a3.mp3',
  C4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c4.mp3',
  'D#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds4.mp3',
  'F#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs4.mp3',
  A4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a4.mp3',
  C5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c5.mp3',
  'D#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds5.mp3',
  'F#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs5.mp3',
  A5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a5.mp3'
}).connect(reverb);
sampler.release.value = 2;

var builtInKeyboard = new AudioKeys({ rows: 2 });
var onScreenKeyboardContainer = document.querySelector('.keyboard');
var onScreenKeyboard = buildKeyboard(onScreenKeyboardContainer);
var machinePlayer = buildKeyboard(document.querySelector('.machine-bg .player'));
var humanPlayer = buildKeyboard(document.querySelector('.human-bg .player'));

var currentSeed = [];
var stopCurrentSequenceGenerator = void 0;
var synthFilter = new Tone.Filter(300, 'lowpass').connect(new Tone.Gain(0.4).toMaster());
var synthConfig = {
  oscillator: { type: 'fattriangle' },
  envelope: { attack: 3, sustain: 1, release: 1 }
};
var synthsPlaying = {};

function isAccidental(note) {
  var pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

function buildKeyboard(container) {
  var nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental).length;
  var keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1);
  var keyInnerWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1) - 0.5;
  var gapPercent = keyWidthPercent - keyInnerWidthPercent;
  var accumulatedWidth = 0;
  return _.range(MIN_NOTE, MAX_NOTE + 1).map(function (note) {
    var accidental = isAccidental(note);
    var key = document.createElement('div');
    key.classList.add('key');
    if (accidental) {
      key.classList.add('accidental');
      key.style.left = accumulatedWidth - gapPercent - (keyWidthPercent / 2 - gapPercent) / 2 + '%';
      key.style.width = keyWidthPercent / 2 + '%';
    } else {
      key.style.left = accumulatedWidth + '%';
      key.style.width = keyInnerWidthPercent + '%';
    }
    container.appendChild(key);
    if (!accidental) accumulatedWidth += keyWidthPercent;
    return key;
  });
}

// Melodies encoded in a one-hot vector, where 0 = no event, 1 = note off, the rest are note ons.
function encodeMelodyNote(note) {
  var idx = note < 0 ? note + 2 : note - MIN_NOTE + 2;
  return _.times(MAX_NOTE - MIN_NOTE + 2, function (i) {
    return i === idx ? 1 : 0;
  });
}
function decodeMelodyIndex(index) {
  if (index - 2 < 0) {
    return index - 2;
  } else {
    return index - 2 + MIN_NOTE;
  }
}

// Control chords encoded in a one-hot vector, where
// 0 = no chord,
// 1-13 = root pitch class,
// 14-25 = chord pitch classes,
// 26-38 = bass pitch class
function encodePitchChord(chord) {
  var oneHot = _.times(3 * 12 + 1, function () {
    return 0;
  });
  if (chord === null) {
    oneHot[0] = 1;
    return oneHot;
  }
  var chordPcs = chord.map(function (n) {
    return n % 12;
  });
  // Root pc
  oneHot[1 + chordPcs[0]] = 1;
  // Pitches
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = chordPcs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var pc = _step.value;

      oneHot[1 + 12 + pc] = 1;
    }
    // Bass pc (=root)
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  oneHot[1 + 12 + 12 + chordPcs[0]] = 1;
  return oneHot;
}

function generateNote(chord, prevNote, state, output) {
  var _this = this;

  if (!state) {
    state = [dl.Array2D.zeros([1, lstm.bias1.shape[0] / 4]), dl.Array2D.zeros([1, lstm.bias2.shape[0] / 4]), dl.Array2D.zeros([1, lstm.bias3.shape[0] / 4])];
    output = [dl.Array2D.zeros([1, lstm.bias1.shape[0] / 4]), dl.Array2D.zeros([1, lstm.bias2.shape[0] / 4]), dl.Array2D.zeros([1, lstm.bias3.shape[0] / 4])];
  }

  return math.scope(function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(keep) {
      var lstm1, lstm2, lstm3, input, nextOutput, outputH, weightedResult, logits, softmax, sampledOutput;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              lstm1 = math.basicLSTMCell.bind(math, forgetBias, lstm.kernel1, lstm.bias1);
              lstm2 = math.basicLSTMCell.bind(math, forgetBias, lstm.kernel2, lstm.bias2);
              lstm3 = math.basicLSTMCell.bind(math, forgetBias, lstm.kernel3, lstm.bias3);
              input = dl.Array1D.new(encodePitchChord(chord).concat(encodeMelodyNote(prevNote)));
              nextOutput = math.multiRNNCell([lstm1, lstm2, lstm3], input.as2D(1, -1), state, output);


              state.forEach(function (s) {
                return s.dispose();
              });
              output.forEach(function (o) {
                return o.dispose();
              });
              state = nextOutput[0];
              output = nextOutput[1];
              state.forEach(function (s) {
                return keep(s);
              });
              output.forEach(function (o) {
                return keep(o);
              });

              outputH = output[2];
              weightedResult = math.matMul(outputH, lstm.fullyConnectedWeights);
              logits = math.add(weightedResult, lstm.fullyConnectedBiases);
              softmax = math.softmax(math.divide(logits.as1D(), temperature));
              sampledOutput = math.multinomial(softmax, 1).asScalar();
              _context.t0 = decodeMelodyIndex;
              _context.next = 19;
              return sampledOutput.data();

            case 19:
              _context.t1 = _context.sent;
              _context.t2 = (0, _context.t0)(_context.t1);
              _context.t3 = state;
              _context.t4 = output;
              return _context.abrupt('return', {
                note: _context.t2,
                state: _context.t3,
                output: _context.t4
              });

            case 24:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }());
}

function getSeedIntervals(seed) {
  var intervals = [];

  var _loop = function _loop(i) {
    var rawInterval = seed[i + 1].time - seed[i].time;
    var measure = _.minBy(['16n', '8n', '4n'], function (subdiv) {
      return Math.abs(rawInterval - Tone.Time(subdiv).toSeconds());
    });
    intervals.push(Tone.Time(measure).toSeconds());
  };

  for (var i = 0; i < seed.length - 1; i++) {
    _loop(i);
  }
  return intervals;
}

function getSequenceLaunchWaitTime(seed) {
  if (seed.length <= 1) {
    return 1;
  }
  var intervals = getSeedIntervals(seed);
  var maxInterval = _.max(intervals);
  return maxInterval * 2;
}

function getSequencePlayIntervalTime(seed) {
  if (seed.length <= 1) {
    return Tone.Time('16n').toSeconds();
  }
  var intervals = getSeedIntervals(seed).sort();
  return _.first(intervals);
}

function startSequenceGenerator(seed) {
  var state = void 0,
      output = void 0,
      running = true,
      lastGenerationTask = Promise.resolve();

  var chord = seed.map(function (s) {
    return s.note;
  }).sort();
  var lastNote = _.last(seed).note;
  var generatedSequence = Math.random() < 0.7 ? [lastNote] : [];
  var launchWaitTime = getSequenceLaunchWaitTime(seed);
  var playIntervalTime = getSequencePlayIntervalTime(seed);
  var generationIntervalTime = playIntervalTime / 2;

  function generateNext() {
    if (!running) return;
    if (generatedSequence.length < 10) {
      lastGenerationTask = generateNote(chord, lastNote, state, output).then(function (result) {
        state = result.state;
        output = result.output;
        generatedSequence.push(result.note);
        lastNote = result.note;
        setTimeout(generateNext, generationIntervalTime * 1000);
      });
    } else {
      setTimeout(generateNext, generationIntervalTime * 1000);
    }
  }

  function consumeNext(time) {
    if (generatedSequence.length) {
      var note = generatedSequence.shift();
      if (note > 0) {
        machineKeyDown(note, time);
      }
    }
  }

  setTimeout(generateNext, launchWaitTime * 1000);
  var consumerId = Tone.Transport.scheduleRepeat(consumeNext, playIntervalTime, Tone.Transport.seconds + launchWaitTime);

  return function () {
    running = false;
    Tone.Transport.clear(consumerId);
    lastGenerationTask.then(function () {
      if (state) state.forEach(function (s) {
        return s.dispose();
      });
      if (output) output.forEach(function (o) {
        return o.dispose();
      });
    });
  };
}

function updateChord(_ref2) {
  var _ref2$add = _ref2.add,
      add = _ref2$add === undefined ? null : _ref2$add,
      _ref2$remove = _ref2.remove,
      remove = _ref2$remove === undefined ? null : _ref2$remove;

  if (add) {
    currentSeed.push({ note: add, time: Tone.now() });
  }
  if (remove && _.some(currentSeed, { note: remove })) {
    _.remove(currentSeed, { note: remove });
  }

  if (stopCurrentSequenceGenerator) {
    stopCurrentSequenceGenerator();
    stopCurrentSequenceGenerator = null;
  }
  if (currentSeed.length && !stopCurrentSequenceGenerator) {
    resetState = true;
    stopCurrentSequenceGenerator = startSequenceGenerator(_.cloneDeep(currentSeed));
  }
}

function humanKeyDown(note) {
  var velocity = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.7;

  if (note < MIN_NOTE || note > MAX_NOTE) return;
  var freq = Tone.Frequency(note, 'midi');
  var synth = new Tone.Synth(synthConfig).connect(synthFilter);
  synthsPlaying[note] = synth;
  synth.triggerAttack(freq, Tone.now(), velocity);
  sampler.triggerAttack(freq);
  updateChord({ add: note });
  humanPlayer[note - MIN_NOTE].classList.add('down');
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, true);
}

function humanKeyUp(note) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  if (synthsPlaying[note]) {
    var synth = synthsPlaying[note];
    synth.triggerRelease();
    setTimeout(function () {
      return synth.dispose();
    }, 2000);
    synthsPlaying[note] = null;
  }
  updateChord({ remove: note });
  humanPlayer[note - MIN_NOTE].classList.remove('down');
}

function machineKeyDown(note, time) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  sampler.triggerAttack(Tone.Frequency(note, 'midi'));
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, false);
  animateMachine(machinePlayer[note - MIN_NOTE]);
}

function animatePlay(keyEl, note, isHuman) {
  var sourceColor = isHuman ? '#1E88E5' : '#E91E63';
  var targetColor = isAccidental(note) ? 'black' : 'white';
  keyEl.animate([{ backgroundColor: sourceColor }, { backgroundColor: targetColor }], { duration: 700, easing: 'ease-out' });
}
function animateMachine(keyEl) {
  keyEl.animate([{ opacity: 0.9 }, { opacity: 0 }], {
    duration: 700,
    easing: 'ease-out'
  });
}

// Computer keyboard controls

builtInKeyboard.down(function (note) {
  humanKeyDown(note.note);
  hideUI();
});
builtInKeyboard.up(function (note) {
  return humanKeyUp(note.note);
});

// MIDI Controls

WebMidi.enable(function (err) {
  if (err) {
    console.error('WebMidi could not be enabled', err);
    return;
  }
  document.querySelector('.midi-not-supported').style.display = 'none';

  var withInputsMsg = document.querySelector('.midi-supported-with-inputs');
  var noInputsMsg = document.querySelector('.midi-supported-no-inputs');
  var selector = document.querySelector('#midi-inputs');
  var activeInput = void 0;

  function onInputsChange() {
    if (WebMidi.inputs.length === 0) {
      withInputsMsg.style.display = 'none';
      noInputsMsg.style.display = 'block';
      onActiveInputChange(null);
    } else {
      noInputsMsg.style.display = 'none';
      withInputsMsg.style.display = 'block';
      while (selector.firstChild) {
        selector.firstChild.remove();
      }
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = WebMidi.inputs[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var input = _step2.value;

          var option = document.createElement('option');
          option.value = input.id;
          option.innerText = input.name;
          selector.appendChild(option);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      onActiveInputChange(WebMidi.inputs[0].id);
    }
  }

  function onActiveInputChange(id) {
    if (activeInput) {
      activeInput.removeListener();
    }
    var input = WebMidi.getInputById(id);
    input.addListener('noteon', 'all', function (e) {
      humanKeyDown(e.note.number, e.velocity);
      hideUI();
    });
    input.addListener('noteoff', 'all', function (e) {
      return humanKeyUp(e.note.number);
    });
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = Array.from(selector.children)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var option = _step3.value;

        option.selected = option.value === id;
      }
    } catch (err) {
      _didIteratorError3 = true;
      _iteratorError3 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion3 && _iterator3.return) {
          _iterator3.return();
        }
      } finally {
        if (_didIteratorError3) {
          throw _iteratorError3;
        }
      }
    }

    activeInput = input;
  }

  onInputsChange();
  WebMidi.addListener('connected', onInputsChange);
  WebMidi.addListener('disconnected', onInputsChange);
  selector.addEventListener('change', function (evt) {
    return onActiveInputChange(evt.target.value);
  });
});

// Mouse & touch Controls

var pointedNotes = new Set();

function updateTouchedNotes(evt) {
  var touchedNotes = new Set();
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = Array.from(evt.touches)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var touch = _step4.value;

      var element = document.elementFromPoint(touch.clientX, touch.clientY);
      var keyIndex = onScreenKeyboard.indexOf(element);
      if (keyIndex >= 0) {
        touchedNotes.add(MIN_NOTE + keyIndex);
        if (!evt.defaultPrevented) {
          evt.preventDefault();
        }
      }
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = pointedNotes[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var note = _step5.value;

      if (!touchedNotes.has(note)) {
        humanKeyUp(note);
        pointedNotes.delete(note);
      }
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5.return) {
        _iterator5.return();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
  }

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = touchedNotes[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var _note = _step6.value;

      if (!pointedNotes.has(_note)) {
        humanKeyDown(_note);
        pointedNotes.add(_note);
      }
    }
  } catch (err) {
    _didIteratorError6 = true;
    _iteratorError6 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion6 && _iterator6.return) {
        _iterator6.return();
      }
    } finally {
      if (_didIteratorError6) {
        throw _iteratorError6;
      }
    }
  }
}

onScreenKeyboard.forEach(function (noteEl, index) {
  noteEl.addEventListener('mousedown', function (evt) {
    humanKeyDown(MIN_NOTE + index);
    pointedNotes.add(MIN_NOTE + index);
    evt.preventDefault();
  });
  noteEl.addEventListener('mouseover', function () {
    if (pointedNotes.size && !pointedNotes.has(MIN_NOTE + index)) {
      humanKeyDown(MIN_NOTE + index);
      pointedNotes.add(MIN_NOTE + index);
    }
  });
});
document.documentElement.addEventListener('mouseup', function () {
  pointedNotes.forEach(function (n) {
    return humanKeyUp(n);
  });
  pointedNotes.clear();
});
document.documentElement.addEventListener('touchstart', updateTouchedNotes);
document.documentElement.addEventListener('touchmove', updateTouchedNotes);
document.documentElement.addEventListener('touchend', updateTouchedNotes);

// Temperature control

var tempSlider = new mdc.slider.MDCSlider(document.querySelector('#temperature'));
tempSlider.listen('MDCSlider:change', function () {
  return temperature.set(tempSlider.value);
});

// Controls hiding

var container = document.querySelector('.container');

function hideUI() {
  container.classList.add('ui-hidden');
}
var scheduleHideUI = _.debounce(hideUI, 5000);
container.addEventListener('mousemove', function () {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});
container.addEventListener('touchstart', function () {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});

// Startup

var bufferLoadPromise = new Promise(function (res) {
  return Tone.Buffer.on('load', res);
});
Promise.all([bufferLoadPromise, rnnLoadPromise]).then(function () {
  Tone.Transport.start();
  onScreenKeyboardContainer.classList.add('loaded');
  document.querySelector('.loading').remove();
});

StartAudioContext(Tone.context, document.documentElement);