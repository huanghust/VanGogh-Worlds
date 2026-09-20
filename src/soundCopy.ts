import type { Lang } from './i18n'

const en = {
  master: 'Overall volume', music: 'Music', nature: 'Nature sounds', effects: 'Sound effects',
  intro: 'Find your balance. Each volume is saved on this device.',
  musicHint: 'The soundtrack in each painting.', natureHint: 'Wind, rain, and birds in the distance.',
  effectsHint: 'Chat chirps and sounds from interacting with the painting.',
  mute: 'Mute', unmute: 'Unmute', muted: 'Muted',
}
type SoundCopy = Record<keyof typeof en, string>
export const SOUND_COPY: Record<Lang, SoundCopy> = {
  en,
  zhCN: { master: '总音量', music: '音乐', nature: '自然环境声', effects: '音效', intro: '调整到你喜欢的声音搭配，设置会保存在这台设备上。', musicHint: '每幅画卷的背景音乐。', natureHint: '风声、雨声和远处的鸟鸣。', effectsHint: '聊天提示音和与画卷互动时的声音。', mute: '静音', unmute: '取消静音', muted: '已静音' },
  zhTW: { master: '總音量', music: '音樂', nature: '自然環境聲', effects: '音效', intro: '調整到你喜歡的聲音搭配，設定會儲存在這台裝置上。', musicHint: '每幅畫卷的背景音樂。', natureHint: '風聲、雨聲和遠處的鳥鳴。', effectsHint: '聊天提示音和與畫卷互動時的聲音。', mute: '靜音', unmute: '取消靜音', muted: '已靜音' },
  ja: { master: '全体の音量', music: '音楽', nature: '自然の音', effects: '効果音', intro: 'お好みの音量バランスに調整できます。設定はこの端末に保存されます。', musicHint: 'それぞれの絵で流れる音楽。', natureHint: '風や雨、遠くの鳥の声。', effectsHint: 'チャットの通知音や、絵に触れたときの音。', mute: 'ミュート', unmute: 'ミュート解除', muted: 'ミュート中' },
  es: { master: 'Volumen general', music: 'Música', nature: 'Sonidos de la naturaleza', effects: 'Efectos de sonido', intro: 'Ajusta el sonido a tu gusto. Los volúmenes se guardan en este dispositivo.', musicHint: 'La música de cada cuadro.', natureHint: 'Viento, lluvia y pájaros a lo lejos.', effectsHint: 'Avisos del chat y sonidos al interactuar con el cuadro.', mute: 'Silenciar', unmute: 'Activar sonido', muted: 'Silenciado' },
  fr: { master: 'Volume général', music: 'Musique', nature: 'Sons de la nature', effects: 'Effets sonores', intro: 'Trouvez l’équilibre qui vous plaît. Les volumes sont enregistrés sur cet appareil.', musicHint: 'La musique de chaque tableau.', natureHint: 'Le vent, la pluie et les oiseaux au loin.', effectsHint: 'Les notifications du chat et les sons des interactions avec le tableau.', mute: 'Couper le son', unmute: 'Rétablir le son', muted: 'Son coupé' },
  de: { master: 'Gesamtlautstärke', music: 'Musik', nature: 'Naturgeräusche', effects: 'Soundeffekte', intro: 'Stimme die Klänge nach deinem Geschmack ab. Die Lautstärken werden auf diesem Gerät gespeichert.', musicHint: 'Die Musik in jedem Gemälde.', natureHint: 'Wind, Regen und Vogelstimmen in der Ferne.', effectsHint: 'Chat-Benachrichtigungen und Geräusche beim Interagieren mit dem Gemälde.', mute: 'Stummschalten', unmute: 'Ton einschalten', muted: 'Stumm' },
  nl: { master: 'Algemeen volume', music: 'Muziek', nature: 'Natuurgeluiden', effects: 'Geluidseffecten', intro: 'Kies de balans die jij prettig vindt. De volumes worden op dit apparaat bewaard.', musicHint: 'De muziek in elk schilderij.', natureHint: 'Wind, regen en vogels in de verte.', effectsHint: 'Chatmeldingen en geluiden bij interacties met het schilderij.', mute: 'Dempen', unmute: 'Geluid aanzetten', muted: 'Gedempt' },
}

