const D = {
  en: {
    tab_loop: 'Loop', tab_rec: 'Record', tab_sep: 'Separate', tab_lib: 'Library',
    tap: 'Tap', play: 'Play', stop: 'Stop',
    grp_gongs: 'Gongs', grp_hats: 'Hi-hats', grp_african: 'African percussion', grp_kit: 'Kit & other', grp_samples: 'My samples',
    steps: 'Steps / bar', preset: 'Preset', master: 'Master', add_instr: 'Add instrument', add: 'Add',
    pads: 'Live pads', clips: 'Recorded loops', no_clips: 'No recorded loops yet (Record tab).',
    proj_name: 'Project name', save: 'Save project', export: 'Export loop (WAV)', clear: 'Clear pattern', import_sample: 'Import audio sample',
    rec_title: 'Record your own beats', rec_bars: 'Length (bars)', rec_count: 'Count-in', rec_lat: 'Latency offset (ms)',
    rec_mic: 'Enable microphone', rec_go: 'Record synced loop', rec_tip: 'Use headphones so the metronome and loop are not picked up by the microphone.',
    rec_one: 'Record a one-shot sample', rec_start: 'Start', rec_end: 'Stop & save', rec_name: 'Sample name',
    sep_title: 'Separate a song into tracks', sep_server: 'Server address', sep_token: 'Token (optional)', sep_test: 'Test connection',
    sep_file: 'Choose a song', sep_model: 'Model', sep_fmt: 'Output format', sep_go: 'Separate',
    sep_help: 'Separation runs on a computer running server/server.py (Demucs). Results are downloaded into the app storage.',
    sep_player: 'Stem player',
    lib_projects: 'Projects', lib_exports: 'Exported loops', lib_samples: 'Samples', lib_recs: 'Recordings', lib_stems: 'Separated songs',
    lib_refresh: 'Refresh', load: 'Load', del: 'Delete', open: 'Open', play_btn: 'Play',
    dl: 'Export to Downloads', t_dl: 'Exported (Downloads/LoopStation)',
    perm_title: 'Permissions', ok: 'Allow', later: 'Later',
    perm_body: 'LoopStation needs the microphone (to record your beats) and its own storage space (to keep loops and separated tracks). Android may show one or two system prompts; on recent Android versions the app\'s private storage needs no prompt.',
    empty: 'Nothing here yet.',
    t_saved: 'Saved', t_exported: 'Exported to library', t_mic_ok: 'Microphone ready', t_mic_fail: 'Microphone unavailable or denied',
    t_recording: 'Recording…', t_countin: 'Count-in…', t_done: 'Take added', t_err: 'Error: ', t_loaded: 'Loaded', t_imported: 'Sample imported',
    t_srv_ok: 'Server OK', t_uploading: 'Uploading…', t_working: 'Separating… {0}s', t_downloading: 'Downloading {0}', t_sep_done: 'Done — saved in Library',
    t_pick: 'Pick a file first', t_lock: 'Locked while recording', t_clip_pitch: 'Loops recorded at another BPM change pitch when you change BPM.',
  },
  fr: {
    tab_loop: 'Boucle', tab_rec: 'Enregistrer', tab_sep: 'Séparer', tab_lib: 'Bibliothèque',
    tap: 'Tap', play: 'Lecture', stop: 'Stop',
    grp_gongs: 'Gongs', grp_hats: 'Hi-hats', grp_african: 'Percussions africaines', grp_kit: 'Batterie & autres', grp_samples: 'Mes samples',
    steps: 'Pas / mesure', preset: 'Préréglage', master: 'Volume', add_instr: 'Ajouter un instrument', add: 'Ajouter',
    pads: 'Pads en direct', clips: 'Boucles enregistrées', no_clips: 'Aucune boucle enregistrée (onglet Enregistrer).',
    proj_name: 'Nom du projet', save: 'Sauvegarder le projet', export: 'Exporter la boucle (WAV)', clear: 'Effacer le motif', import_sample: 'Importer un sample audio',
    rec_title: 'Enregistrez vos propres rythmes', rec_bars: 'Durée (mesures)', rec_count: 'Décompte', rec_lat: 'Décalage de latence (ms)',
    rec_mic: 'Activer le micro', rec_go: 'Enregistrer une boucle synchronisée', rec_tip: 'Utilisez un casque pour que le métronome et la boucle ne soient pas captés par le micro.',
    rec_one: 'Enregistrer un sample', rec_start: 'Démarrer', rec_end: 'Arrêter et sauver', rec_name: 'Nom du sample',
    sep_title: 'Séparer un morceau en pistes', sep_server: 'Adresse du serveur', sep_token: 'Jeton (optionnel)', sep_test: 'Tester la connexion',
    sep_file: 'Choisir un morceau', sep_model: 'Modèle', sep_fmt: 'Format de sortie', sep_go: 'Séparer',
    sep_help: 'La séparation s\'exécute sur un ordinateur qui fait tourner server/server.py (Demucs). Les résultats sont téléchargés dans le stockage de l\'app.',
    sep_player: 'Lecteur de pistes',
    lib_projects: 'Projets', lib_exports: 'Boucles exportées', lib_samples: 'Samples', lib_recs: 'Enregistrements', lib_stems: 'Morceaux séparés',
    lib_refresh: 'Actualiser', load: 'Charger', del: 'Supprimer', open: 'Ouvrir', play_btn: 'Écouter',
    dl: 'Exporter vers Téléchargements', t_dl: 'Exporté (Téléchargements/LoopStation)',
    perm_title: 'Autorisations', ok: 'Autoriser', later: 'Plus tard',
    perm_body: 'LoopStation a besoin du micro (pour enregistrer vos rythmes) et de son propre espace de stockage (pour garder boucles et pistes séparées). Android peut afficher une ou deux demandes ; sur les versions récentes, le stockage privé de l\'app n\'en demande pas.',
    empty: 'Rien ici pour l\'instant.',
    t_saved: 'Sauvegardé', t_exported: 'Exporté dans la bibliothèque', t_mic_ok: 'Micro prêt', t_mic_fail: 'Micro indisponible ou refusé',
    t_recording: 'Enregistrement…', t_countin: 'Décompte…', t_done: 'Prise ajoutée', t_err: 'Erreur : ', t_loaded: 'Chargé', t_imported: 'Sample importé',
    t_srv_ok: 'Serveur OK', t_uploading: 'Envoi…', t_working: 'Séparation… {0}s', t_downloading: 'Téléchargement {0}', t_sep_done: 'Terminé — dans la Bibliothèque',
    t_pick: 'Choisissez d\'abord un fichier', t_lock: 'Verrouillé pendant l\'enregistrement', t_clip_pitch: 'Les boucles enregistrées à un autre BPM changent de hauteur quand vous changez le BPM.',
  },
};

let L = localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2);
if (!D[L]) L = 'en';

export const lang = () => L;
export function t(k, ...a) {
  let s = D[L][k] ?? D.en[k] ?? k;
  a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  document.documentElement.lang = L;
}
export function setLang(l) {
  L = l;
  localStorage.setItem('lang', l);
  applyI18n();
}
