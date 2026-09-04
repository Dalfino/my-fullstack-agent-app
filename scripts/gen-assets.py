#!/usr/bin/env python3
"""Generate demo visual assets for TalentShowcase showcase blocks (Phase A).

Outputs into scripts/assets/ and a base64 PNG for embedding in the seed notebook.
All text is English (matches platform language).
"""
import base64
import json
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm

for fp in [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]:
    if os.path.exists(fp):
        fm.fontManager.addfont(fp)

import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=150, facecolor='white')
    plt.close(fig)
    print('wrote', path)
    return path


# ---------------------------------------------------------------- 1. dashboard mock (fullstack hero)
def dashboard_mock():
    fig = plt.figure(figsize=(12.8, 7.2), facecolor='#0f172a')
    # browser chrome bar
    fig.add_axes([0, 0.925, 1, 0.075]).set_facecolor('#1e293b')
    for ax in fig.axes:
        ax.set_xticks([]); ax.set_yticks([])
        for s in ax.spines.values():
            s.set_visible(False)
    ax = fig.add_axes([0, 0.925, 1, 0.075])
    for i, c in enumerate(['#ef4444', '#eab308', '#22c55e']):
        ax.add_patch(plt.Circle((0.02 + i * 0.018, 0.5), 0.008, color=c, transform=ax.transAxes, clip_on=False))
    ax.text(0.06, 0.5, 'feedback-analytics.internal/reports', color='#94a3b8', fontsize=11,
            transform=ax.transAxes, va='center')

    title_ax = fig.add_axes([0, 0.84, 1, 0.08]); title_ax.set_facecolor('#0f172a')
    title_ax.set_xticks([]); title_ax.set_yticks([])
    for s in title_ax.spines.values(): s.set_visible(False)
    title_ax.text(0.03, 0.5, 'Customer Feedback Trends', color='#f1f5f9', fontsize=20, fontweight='bold',
                  transform=title_ax.transAxes, va='center')
    title_ax.text(0.03, 0.06, 'Sentiment across 12,418 feedback items · last 26 weeks', color='#64748b',
                  fontsize=11, transform=title_ax.transAxes, va='center')

    # main trend chart
    weeks = np.arange(26)
    pos = 52 + 18 * np.sin(np.linspace(0, 5.2, 26)) + rng.normal(0, 2.5, 26).cumsum() * 0.35
    neg = 30 - 8 * np.sin(np.linspace(0, 4.1, 26)) + rng.normal(0, 2, 26).cumsum() * 0.28
    ax1 = fig.add_axes([0.05, 0.13, 0.56, 0.66]); ax1.set_facecolor('#1e293b')
    ax1.plot(weeks, pos, color='#34d399', lw=2.5, label='Positive mentions')
    ax1.plot(weeks, neg, color='#f87171', lw=2.5, label='Negative mentions')
    ax1.fill_between(weeks, pos, alpha=0.15, color='#34d399')
    ax1.set_title('Weekly sentiment trend', color='#e2e8f0', fontsize=13, loc='left')
    ax1.tick_params(colors='#64748b', labelsize=9)
    for s in ax1.spines.values(): s.set_color('#334155')
    ax1.grid(color='#334155', lw=0.4, alpha=0.6)
    ax1.legend(frameon=False, labelcolor='#cbd5e1', fontsize=10, loc='upper left')

    # side KPIs
    kpis = [('Sentiment score', '+24.6', '#34d399'), ('Items processed', '12,418', '#60a5fa'),
            ('Avg. response time', '1.8 s', '#a78bfa'), ('Topics tracked', '37', '#fbbf24')]
    for i, (label, value, color) in enumerate(kpis):
        y = 0.705 - i * 0.165
        kax = fig.add_axes([0.66, y, 0.29, 0.13]); kax.set_facecolor('#1e293b')
        kax.set_xticks([]); kax.set_yticks([])
        for s in kax.spines.values(): s.set_visible(False)
        kax.text(0.08, 0.66, label, color='#94a3b8', fontsize=10, transform=kax.transAxes)
        kax.text(0.08, 0.22, value, color=color, fontsize=19, fontweight='bold', transform=kax.transAxes)

    save(fig, 'dashboard_mock.png')


# ---------------------------------------------------------------- 2. ML loss curves + confusion matrix
def loss_curves():
    epochs = np.arange(1, 31)
    tr = 0.62 * np.exp(-epochs / 9) + 0.14 + rng.normal(0, 0.008, 30)
    va = 0.64 * np.exp(-epochs / 8.4) + 0.19 + rng.normal(0, 0.012, 30)
    fig, ax = plt.subplots(figsize=(7.2, 4.4), constrained_layout=True)
    ax.plot(epochs, tr, label='Training loss', color='#2563eb', lw=2)
    ax.plot(epochs, va, label='Validation loss', color='#f59e0b', lw=2, ls='--')
    ax.set_xlabel('Epoch'); ax.set_ylabel('Binary cross-entropy')
    ax.set_title('Churn model — training curves (XGBoost, 30 epochs)')
    ax.grid(alpha=0.3); ax.legend(frameon=False)
    return save(fig, 'churn_loss_curve.png')


def confusion_matrix():
    labels = ['Retained', 'Churned']
    m = np.array([[1428, 96], [117, 359]])
    fig, ax = plt.subplots(figsize=(5.6, 4.8), constrained_layout=True)
    im = ax.imshow(m, cmap='Blues')
    ax.set_xticks([0, 1], labels); ax.set_yticks([0, 1], labels)
    ax.set_xlabel('Predicted'); ax.set_ylabel('Actual')
    ax.set_title('Confusion matrix — holdout set')
    thresh = m.max() / 2
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(m[i, j]), ha='center', va='center', fontsize=14,
                    color='white' if m[i, j] > thresh else '#0f172a')
    fig.colorbar(im, ax=ax, shrink=0.85)
    return save(fig, 'churn_confusion_matrix.png')


# ---------------------------------------------------------------- 3. design kit
def logo_variants():
    fig, axes = plt.subplots(1, 3, figsize=(10.5, 3.6), constrained_layout=True)
    fig.patch.set_facecolor('white')
    variants = [('#2563eb', 'white'), ('white', '#2563eb'), ('#0f172a', '#fbbf24')]
    names = ['Primary', 'Reversed', 'Monogram']
    for ax, (bg, fg), name in zip(axes, variants, names):
        ax.set_facecolor(bg)
        ax.set_xticks([]); ax.set_yticks([])
        for s in ax.spines.values(): s.set_visible(False)
        t = ax.text(0.5, 0.52, 'nimbus', ha='center', va='center', fontsize=30,
                    fontweight='bold', color=fg, transform=ax.transAxes)
        t.set_style('italic')
        ax.text(0.5, 0.24, '◆', ha='center', va='center', fontsize=13, color=fg, transform=ax.transAxes)
        ax.text(0.5, 0.06, name, ha='center', fontsize=10, color=fg if bg != 'white' else '#0f172a',
                transform=ax.transAxes, alpha=0.7)
    fig.suptitle('Nimbus — logo lockups', fontsize=13, fontweight='bold')
    return save(fig, 'design_logo_variants.png')


def color_palette():
    fig, ax = plt.subplots(figsize=(10.5, 3.2), constrained_layout=True)
    palette = [('#2563eb', 'Blue 600', '#FFFFFF'), ('#3b82f6', 'Blue 500', '#FFFFFF'),
               ('#93c5fd', 'Blue 300', '#0F172A'), ('#fbbf24', 'Amber 400', '#0F172A'),
               ('#0f172a', 'Slate 900', '#FFFFFF'), ('#f1f5f9', 'Slate 100', '#0F172A')]
    for i, (hexc, name, tc) in enumerate(palette):
        ax.add_patch(plt.Rectangle((i, 0.25), 0.94, 0.75, color=hexc))
        ax.text(i + 0.47, 0.6, name, ha='center', color=tc, fontsize=12, fontweight='bold')
        ax.text(i + 0.47, 0.38, hexc, ha='center', color=tc, fontsize=9)
    ax.set_xlim(0, 5.64); ax.set_ylim(0, 1.15); ax.axis('off')
    fig.suptitle('Nimbus — core palette', fontsize=13, fontweight='bold')
    return save(fig, 'design_color_palette.png')


def typography():
    fig, ax = plt.subplots(figsize=(10.5, 3.6), constrained_layout=True)
    ax.axis('off')
    samples = [
        ('Inter Bold · Display', 24, 'bold'),
        ('Inter Regular · Body', 15, 'normal'),
        ('JetBrains Mono · Code', 13, 'normal'),
    ]
    y = 0.82
    for label, size, weight in samples:
        ax.text(0.02, y, label, fontsize=size, fontweight=weight, family='DejaVu Sans',
                transform=ax.transAxes, va='top')
        y -= 0.3
    ax.text(0.02, 0.02, 'Type scale: 12 / 14 / 16 / 20 / 28 / 36 · line-height 1.5', fontsize=10,
            color='#64748b', transform=ax.transAxes)
    fig.suptitle('Nimbus — typography specimen', fontsize=13, fontweight='bold')
    return save(fig, 'design_typography.png')


# ---------------------------------------------------------------- 4. notebook-embedded PNG (base64)
def notebook_chart_base64():
    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.8), constrained_layout=True)
    ch = ['Email', 'Webhook', 'CSV import', 'Mobile SDK']
    vals = [5210, 3840, 2270, 1098]
    axes[0].barh(ch[::-1], vals[::-1], color='#2563eb')
    axes[0].set_title('Feedback volume by channel')
    days = np.arange(28)
    series = 40 + 12 * np.sin(days / 3.4) + rng.normal(0, 3, 28).cumsum() * 0.18
    axes[1].plot(days, series, color='#7c3aed', lw=2)
    axes[1].fill_between(days, series, alpha=0.15, color='#7c3aed')
    axes[1].set_title('Daily sentiment index')
    fig.tight_layout()
    path = os.path.join(OUT, 'nb_channel_chart.png')
    fig.savefig(path, dpi=130, facecolor='white')
    plt.close(fig)
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    print('wrote', path, f'({len(b64)} b64 chars)')
    with open(os.path.join(OUT, 'nb_chart_b64.json'), 'w') as f:
        json.dump({'image/png': b64}, f)
    return path


if __name__ == '__main__':
    dashboard_mock()
    loss_curves()
    confusion_matrix()
    logo_variants()
    color_palette()
    typography()
    notebook_chart_base64()
    print('all assets done ->', OUT)
