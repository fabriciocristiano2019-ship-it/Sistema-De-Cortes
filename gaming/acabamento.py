"""Acabamento animado dos cortes de jogo (owner, 19-nov-2026).

One ffmpeg pass on top of the montage (gaming/montagem.py), all drawn with
ASS so it needs no new program and renders the same on every machine:

  0.00-0.25 s  white flash and a whoosh: the cut opens with a punch
  0.00-0.30 s  the title, on a torn red paper strip like the owner's model
               Short, pops in and stays for the whole clip (on the seam between
               webcam and game, or near the top without webcam)
  start        optional voice-over (gaming/voz.py) reading the hook question,
               with the game sound lowered while it talks

Captions are burned afterwards by the existing caption step, on top.
Rules from the motion skills (charlie947): one move per element, stagger,
no typewriter, nothing in the bottom 500 px or the right 120 px.
"""
import hashlib
import os
import re
import subprocess

from ffmpeg_utils import LOUDNORM_FILTER, METADATA_SCRUB, QUALITY, audio_encode_args, video_encode_args

W, H = 1080, 1920
AMARELO = "&H0000D4FF&"      # ASS is BGR: #FFD400
BRANCO = "&H00FFFFFF&"
PRETO = "&H00000000&"
VERMELHO = "&H001A12D8&"   # #D8121A, the strip of the model Short

_EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF︎️‍]+")

# Title on screen and the line the narrator says, per moment type. Questions
# and teasers, not labels: "OLHA ESSE HEADSHOT" makes you wait for it.
ROTEIRO = {
    "headshot": [("OLHA ESSA MIRA", "Olha a mira desse cara... presta atenção."),
                 ("DOIS NA CABEÇA?!", "Repara nisso aqui. Dois na cabeça?")],
    "vitoria": [("GANHOU NO FINAL?!", "Será que ele consegue ganhar essa? Olha o final."),
                ("A VIRADA FOI INSANA", "Ninguém acreditava nessa virada. Olha só.")],
    "susto": [("ELE NÃO ESPERAVA ISSO", "Ele não esperava por isso... olha o que acontece."),
              ("QUE SUSTO FOI ESSE?!", "Olha o susto que ele levou aqui.")],
    "clutch": [("1 CONTRA TODOS", "Sozinho contra todo mundo. Olha o que ele fez.")],
    "jogada": [("OLHA O QUE ELE FEZ", "Olha o que ele fez aqui... você não vai acreditar.")],
    "engracado": [("NÃO AGUENTEI ESSA", "Eu não aguentei com essa. Olha só.")],
    "explosao": [("TUDO EXPLODIU", "Olha o que aconteceu aqui. Tudo explodiu.")],
}
PADRAO = [("OLHA O QUE ELE FEZ", "Olha o que ele fez aqui... você não vai acreditar."),
          ("VOCÊ NÃO VAI ACREDITAR", "Você não vai acreditar no que acontece nesse vídeo.")]


def _escolha(opcoes, semente):
    h = int(hashlib.md5(str(semente).encode("utf-8")).hexdigest(), 16)
    return opcoes[h % len(opcoes)]


def roteiro(clip):
    """(title, narration) for a clip: the AI's hook when it wrote a real one,
    else the template of its moment type."""
    momento = str(clip.get("moment_category") or clip.get("moment") or "").lower()
    titulo, fala = _escolha(ROTEIRO.get(momento, PADRAO), clip.get("start", 0))
    gancho = _EMOJI.sub("", str(clip.get("viral_hook_text") or "")).strip()
    # A hook that is a sentence (Gemini) beats the template; a one-word label
    # ("HEADSHOT!") does not.
    if len(gancho.split()) >= 3:
        titulo = gancho
        if not clip.get("narracao"):
            fala = gancho[0].upper() + gancho[1:].lower()
    if clip.get("narracao"):
        fala = str(clip["narracao"]).strip()
    return limpar(titulo), fala


def limpar(texto):
    t = _EMOJI.sub("", str(texto or "")).replace("|", " ").strip().upper()
    return re.sub(r"\s+", " ", t)[:60]


def quebrar(texto, por_linha=15):
    """At most 2 balanced lines."""
    palavras = texto.split()
    if len(texto) <= por_linha or len(palavras) < 2:
        return [texto]
    melhor = None
    for i in range(1, len(palavras)):
        a, b = " ".join(palavras[:i]), " ".join(palavras[i:])
        custo = max(len(a), len(b))
        if melhor is None or custo < melhor[0]:
            melhor = (custo, a, b)
    return [melhor[1], melhor[2]]


def _ass_escape(t):
    return t.replace("\\", "").replace("{", "(").replace("}", ")")


def _destaque(linha, destacar):
    """Key words in yellow, the rest white."""
    out = []
    for p in linha.split():
        cor = AMARELO if p.strip("?!.,") in destacar else BRANCO
        out.append(f"{{\\c{cor}}}{_ass_escape(p)}")
    return " ".join(out)


def _palavras_chave(texto):
    """The last two words carry the payoff ("...ESSA MIRA", "...NÃO ESPERAVA ISSO")."""
    ps = [p.strip("?!.,") for p in texto.split()]
    return set(ps[-2:]) if len(ps) > 2 else set(ps[-1:])


def _t(seg):
    seg = max(0.0, seg)
    h = int(seg // 3600)
    m = int(seg % 3600 // 60)
    return f"{h}:{m:02d}:{seg % 60:05.2f}"


def _faixa_rasgada(largura, altura, semente):
    """ASS drawing of a torn paper strip (0,0)-(largura,altura): jagged top and
    bottom edges, slightly uneven sides. Seeded, so a clip always looks the same."""
    import random
    r = random.Random(semente)
    passo = 26
    topo = [(0, r.randint(0, 10))]
    for x in range(passo, largura, passo):
        topo.append((x, r.randint(0, 14)))
    topo.append((largura, r.randint(0, 10)))
    base = [(largura - r.randint(0, 8), altura - r.randint(0, 10))]
    for x in range(largura - passo, 0, -passo):
        base.append((x, altura - r.randint(0, 14)))
    base.append((r.randint(0, 8), altura - r.randint(0, 10)))
    pts = topo + base
    return "m " + " l ".join(f"{x} {y}" for x, y in pts)


def gerar_ass(path, titulo, duracao, geo=None):
    """Opening flash + the title on a torn red paper strip (the owner's model
    Short), popping in and staying for the whole clip."""
    geo = geo or {"tipo": "shorts", "jogo": [0, H], "titulo_y": 370}
    y = int(geo.get("titulo_y") or 370)
    # Like the model: big condensed capitals, two lines once it is not tiny.
    linhas = quebrar(titulo, por_linha=12)
    maior = max(len(l) for l in linhas)
    tamanho = 118 if maior <= 13 else 100 if maior <= 18 else 84 if maior <= 24 else 70
    alt = int(tamanho * 1.02)
    larg_faixa, alt_faixa = 930, alt * len(linhas) + 50
    fim = _t(duracao)
    semente = sum(map(ord, titulo))
    faixa = _faixa_rasgada(larg_faixa, alt_faixa, semente)
    papel = _faixa_rasgada(larg_faixa + 8, alt_faixa + 14, semente + 1)
    pop = "\\fscx55\\fscy55\\t(0,170,\\fscx106\\fscy106)\\t(170,280,\\fscx100\\fscy100)"
    ev = [
        # opening flash
        f"Dialogue: 0,{_t(0)},{_t(0.28)},Flash,,0,0,0,,"
        f"{{\\an7\\pos(0,0)\\p1\\fad(0,240)}}m 0 0 l {W} 0 {W} {H} 0 {H}{{\\p0}}",
        # white torn paper behind, the red strip on it (two layers = the torn edge)
        f"Dialogue: 1,{_t(0)},{fim},Papel,,0,0,0,,{{\\an5\\pos({W // 2},{y - 4}){pop}\\p1}}{papel}{{\\p0}}",
        f"Dialogue: 2,{_t(0)},{fim},Faixa,,0,0,0,,{{\\an5\\pos({W // 2},{y}){pop}\\p1}}{faixa}{{\\p0}}",
    ]
    topo = y - (alt * (len(linhas) - 1)) // 2
    for i, linha in enumerate(linhas):
        atraso = 60 + i * 90
        anim = (f"\\an5\\pos({W // 2},{topo + i * alt})\\alpha&HFF&\\t({atraso},{atraso + 1},\\alpha&H00&)"
                f"\\fscx70\\fscy70\\t({atraso},{atraso + 200},\\fscx100\\fscy100)")
        ev.append(f"Dialogue: 3,{_t(0)},{fim},Titulo,,0,0,0,,{{{anim}}}{_ass_escape(linha)}")
    cab = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Titulo,Anton,{tamanho},{BRANCO},{BRANCO},{PRETO},&H70000000&,0,0,0,0,100,100,1,0,1,0,4,5,60,60,0,1\n"
        "Style: Flash,Anton,10,&H40FFFFFF&,&H40FFFFFF&,&HFF000000&,&HFF000000&,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n"
        "Style: Papel,Anton,10,&H10F2F2F2&,&H10F2F2F2&,&HFF000000&,&H80000000&,0,0,0,0,100,100,0,0,1,0,5,7,0,0,0,1\n"
        f"Style: Faixa,Anton,10,{VERMELHO},{VERMELHO},&HFF000000&,&HFF000000&,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(cab + "\n".join(ev) + "\n")
    return path


def duracao(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, timeout=60).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def _tem_audio(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", path], capture_output=True, text=True, timeout=60).stdout.strip()
    return bool(out)


def aplicar(clip_path, titulo, out_path, geo=None, voz=None, fontes=None):
    """Burn title + flash + progress bar, add whoosh and optional voice."""
    from subtitles import _escape_ffmpeg_filter_value as esc
    dur = duracao(clip_path)
    if dur <= 0:
        raise RuntimeError("duração ilegível")
    ass = os.path.join(os.path.dirname(out_path) or ".", f"acabamento_{os.getpid()}_{abs(hash(out_path)) % 10**8}.ass")
    gerar_ass(ass, titulo, dur, geo)
    fontes = fontes or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")
    vf = f"[0:v]ass=filename='{esc(ass)}':fontsdir='{esc(fontes)}'[v]"
    # Whoosh: shaped pink noise, synthesised (no sound files to ship).
    whoosh = ("anoisesrc=d=0.7:c=pink:r=48000:a=0.5,highpass=f=250,lowpass=f=5000,"
              "afade=t=in:d=0.12,afade=t=out:st=0.18:d=0.5,volume=0.55,aformat=channel_layouts=stereo[w]")
    entradas = ["-i", clip_path]
    partes = [vf, whoosh]
    mix = ["[w]"]
    voz_dur = duracao(voz) if voz and os.path.exists(voz) else 0.0
    if _tem_audio(clip_path):
        if voz_dur:
            # Game sound down to 30% while the narrator talks, back up after.
            partes.append(f"[0:a]volume='if(lt(t,{voz_dur + 0.3:.2f}),0.3,1)':eval=frame,"
                          "aformat=channel_layouts=stereo[g]")
        else:
            partes.append("[0:a]aformat=channel_layouts=stereo[g]")
        mix.insert(0, "[g]")
    if voz_dur:
        entradas += ["-i", voz]
        partes.append("[1:a]adelay=150|150,volume=1.5,aformat=channel_layouts=stereo[n]")
        mix.append("[n]")
    # Loudness goes inside the graph: ffmpeg refuses -af on a mixed stream.
    norma = f",{LOUDNORM_FILTER}" if os.environ.get("AUDIO_NORMALIZE", "1").strip() != "0" else ""
    partes.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,atrim=0:{dur:.3f}{norma}[a]"
                  if mix[0] == "[g]" else
                  f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,apad,atrim=0:{dur:.3f}{norma}[a]")
    audio = [a for a in audio_encode_args()]
    if "-af" in audio:
        i = audio.index("-af")
        del audio[i:i + 2]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *entradas, "-filter_complex", ";".join(partes),
           "-map", "[v]", "-map", "[a]", *video_encode_args(QUALITY), "-pix_fmt", "yuv420p",
           *audio, *METADATA_SCRUB, "-movflags", "+faststart", out_path]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            raise RuntimeError(r.stderr[-500:])
    finally:
        try:
            os.remove(ass)
        except OSError:
            pass
    return out_path
