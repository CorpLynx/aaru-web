<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, onMount, getContext } from 'svelte';
	const dispatch = createEventDispatcher();

	import { getBackendConfig } from '$lib/apis';
	import {
		getAudioConfig,
		updateAudioConfig,
		getModels as _getModels,
		getVoices as _getVoices
	} from '$lib/apis/audio';
	import { config } from '$lib/stores';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import TTSVoiceInput from '$lib/components/workspace/Models/TTSVoiceInput.svelte';

	import { TTS_RESPONSE_SPLIT } from '$lib/types';

	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import Textarea from '$lib/components/common/Textarea.svelte';
	import SettingsSelect from '$lib/components/common/SettingsSelect.svelte';
	import AdminSettingField from './AdminSettingField.svelte';
	import AdminSettingRow from './AdminSettingRow.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	const i18n = getContext<Writable<i18nType>>('i18n');

	export let saveHandler: () => void;

	// Audio
	let TTS_OPENAI_API_BASE_URL = '';
	let TTS_OPENAI_API_KEY = '';
	let TTS_ENGINE = '';
	let TTS_MODEL = '';
	let TTS_VOICE = '';
	let TTS_OPENAI_PARAMS = '';
	let TTS_SPLIT_ON: TTS_RESPONSE_SPLIT = TTS_RESPONSE_SPLIT.PUNCTUATION;

	let STT_OPENAI_API_BASE_URL = '';
	let STT_OPENAI_API_KEY = '';
	let STT_OPENAI_API_REQUEST_FORMAT = 'multipart';
	let STT_ENGINE = '';
	let STT_MODEL = '';
	let STT_SUPPORTED_CONTENT_TYPES = '';
	let STT_WHISPER_MODEL = '';

	let STT_WHISPER_MODEL_LOADING = false;

	type Voice = {
		id: string;
		name?: string;
		description?: string;
		meta?: {
			description?: string;
		};
	};

	// eslint-disable-next-line no-undef
	let voices: SpeechSynthesisVoice[] = [];
	let providerVoices: Voice[] = [];
	let models: Awaited<ReturnType<typeof _getModels>>['models'] = [];
	const inputClass =
		'w-full h-7 rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500';
	const textareaClass =
		'w-full rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 py-1.5 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500';
	const linkedHelpClass =
		'text-[0.6875rem] text-gray-400 dark:text-gray-600 [&_a]:text-gray-900 [&_a]:hover:underline dark:[&_a]:text-gray-300';

	const getModels = async () => {
		if (TTS_ENGINE === '') {
			models = [];
		} else {
			const res = await _getModels(localStorage.token).catch((e) => {
				toast.error(`${e}`);
			});

			if (res) {
				console.log(res);
				models = res.models;
			}
		}
	};

	const getVoices = async () => {
		if (TTS_ENGINE === '') {
			providerVoices = [];

			const getVoicesLoop = setInterval(() => {
				voices = speechSynthesis.getVoices();

				// do your loop
				if (voices.length > 0) {
					clearInterval(getVoicesLoop);
					voices.sort((a, b) => a.name.localeCompare(b.name, $i18n.resolvedLanguage));
				}
			}, 100);
		} else {
			voices = [];

			const res = await _getVoices(localStorage.token).catch((e) => {
				toast.error(`${e}`);
			});

			if (res) {
				console.log(res);
				providerVoices = res.voices ?? [];
				providerVoices.sort((a, b) =>
					(a.name ?? a.id).localeCompare(b.name ?? b.id, $i18n.resolvedLanguage)
				);
			}
		}
	};

	const updateConfigHandler = async () => {
		let openaiParams = {};
		try {
			openaiParams = TTS_OPENAI_PARAMS ? JSON.parse(TTS_OPENAI_PARAMS) : {};
			TTS_OPENAI_PARAMS = JSON.stringify(openaiParams, null, 2);
		} catch {
			toast.error($i18n.t('Invalid JSON format for Parameters'));
			return;
		}

		const res = await updateAudioConfig(localStorage.token, {
			tts: {
				OPENAI_API_BASE_URL: TTS_OPENAI_API_BASE_URL,
				OPENAI_API_KEY: TTS_OPENAI_API_KEY,
				OPENAI_PARAMS: openaiParams,
				ENGINE: TTS_ENGINE,
				MODEL: TTS_MODEL,
				VOICE: TTS_VOICE,
				SPLIT_ON: TTS_SPLIT_ON
			},
			stt: {
				OPENAI_API_BASE_URL: STT_OPENAI_API_BASE_URL,
				OPENAI_API_KEY: STT_OPENAI_API_KEY,
				OPENAI_API_REQUEST_FORMAT: STT_OPENAI_API_REQUEST_FORMAT,
				ENGINE: STT_ENGINE,
				MODEL: STT_MODEL,
				SUPPORTED_CONTENT_TYPES: STT_SUPPORTED_CONTENT_TYPES.split(','),
				WHISPER_MODEL: STT_WHISPER_MODEL
			}
		});

		if (res) {
			saveHandler();
			config.set(await getBackendConfig());
		}
	};

	const sttModelUpdateHandler = async () => {
		STT_WHISPER_MODEL_LOADING = true;
		await updateConfigHandler();
		STT_WHISPER_MODEL_LOADING = false;
	};

	onMount(async () => {
		const res = await getAudioConfig(localStorage.token);

		if (res) {
			console.log(res);
			TTS_OPENAI_API_BASE_URL = res.tts.OPENAI_API_BASE_URL;
			TTS_OPENAI_API_KEY = res.tts.OPENAI_API_KEY;
			TTS_OPENAI_PARAMS = JSON.stringify(res?.tts?.OPENAI_PARAMS ?? '', null, 2);

			TTS_ENGINE = res.tts.ENGINE;
			TTS_MODEL = res.tts.MODEL;
			TTS_VOICE = res.tts.VOICE;

			TTS_SPLIT_ON = res.tts.SPLIT_ON || TTS_RESPONSE_SPLIT.PUNCTUATION;

			STT_OPENAI_API_BASE_URL = res.stt.OPENAI_API_BASE_URL;
			STT_OPENAI_API_KEY = res.stt.OPENAI_API_KEY;
			STT_OPENAI_API_REQUEST_FORMAT = res.stt.OPENAI_API_REQUEST_FORMAT || 'multipart';

			STT_ENGINE = res.stt.ENGINE;
			STT_MODEL = res.stt.MODEL;
			STT_SUPPORTED_CONTENT_TYPES = (res?.stt?.SUPPORTED_CONTENT_TYPES ?? []).join(',');
			STT_WHISPER_MODEL = res.stt.WHISPER_MODEL;
		}

		await getVoices();
		await getModels();
	});
</script>

<form
	class="flex h-full flex-col justify-between text-sm"
	on:submit|preventDefault={async () => {
		await updateConfigHandler();
		dispatch('save');
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
		{$i18n.t('settings.admin.audio.title')}
	</h2>
	{#if $config?.features?.slim === true}
		<p class="mb-4 text-xs text-gray-500">
			{$i18n.t(
				'Slim requires external speech providers. Local speech models and audio conversion are unavailable.'
			)}
		</p>
	{/if}

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		<AdminSettingSection title={$i18n.t('settings.admin.audio.sections.speechToText.title')} first>
			<AdminSettingRow
				label={$i18n.t('settings.admin.audio.speechToTextEngine.label')}
				description={$i18n.t('settings.admin.audio.speechToTextEngine.description')}
			>
				<SettingsSelect bind:value={STT_ENGINE} placeholder={$i18n.t('Select an engine')}>
					<option value="" disabled={$config?.features?.slim === true}
						>{$i18n.t('Whisper (Local)')}</option
					>
					<option value="openai">{$i18n.t('OpenAI')}</option>
					<option value="web">{$i18n.t('Web API')}</option>
				</SettingsSelect>
			</AdminSettingRow>

			{#if STT_ENGINE !== 'web'}
				<AdminSettingField
					label={$i18n.t('settings.admin.audio.supportedMimeTypes.label')}
					description={$i18n.t('settings.admin.audio.supportedMimeTypes.description')}
				>
					<input
						class={inputClass}
						bind:value={STT_SUPPORTED_CONTENT_TYPES}
						placeholder={$i18n.t('e.g., audio/wav,audio/mpeg,video/* (leave blank for defaults)')}
					/>
				</AdminSettingField>
			{/if}

			{#if STT_ENGINE === 'openai'}
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<AdminSettingField label={$i18n.t('settings.admin.audio.sttOpenaiApiBaseUrl.label')}>
						<input
							class={inputClass}
							placeholder={$i18n.t('settings.admin.audio.sttOpenaiApiBaseUrl.label')}
							bind:value={STT_OPENAI_API_BASE_URL}
							required
						/>
					</AdminSettingField>
					<AdminSettingField label={$i18n.t('settings.admin.audio.sttOpenaiApiKey.label')}>
						<SensitiveInput
							variant="settings"
							placeholder={$i18n.t('settings.admin.audio.sttOpenaiApiKey.label')}
							bind:value={STT_OPENAI_API_KEY}
						/>
					</AdminSettingField>
				</div>

				<AdminSettingRow
					label={$i18n.t('settings.admin.audio.requestFormat.label')}
					description={$i18n.t('settings.admin.audio.requestFormat.description')}
				>
					<SettingsSelect bind:value={STT_OPENAI_API_REQUEST_FORMAT}>
						<option value="multipart">{$i18n.t('Multipart Upload')}</option>
						<option value="json">{$i18n.t('JSON Base64')}</option>
					</SettingsSelect>
				</AdminSettingRow>

				<AdminSettingField label={$i18n.t('settings.admin.audio.sttModel.label')}>
					<input
						class={inputClass}
						bind:value={STT_MODEL}
						placeholder={$i18n.t('Select a model')}
					/>
				</AdminSettingField>
			{:else if STT_ENGINE === ''}
				<!-- LICENSE covers this Open WebUI wordmark.
					Do not alter, remove, obscure, or replace it except as LICENSE permits:
					https://docs.openwebui.com/license. -->
				<AdminSettingField
					label={$i18n.t('settings.admin.audio.sttWhisperModel.label')}
					description={$i18n.t('settings.admin.audio.sttWhisperModel.description')}
				>
					<div class="flex w-full gap-2">
						<input
							class={inputClass}
							placeholder={$i18n.t('Set whisper model')}
							bind:value={STT_WHISPER_MODEL}
						/>
						<button
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-white"
							type="button"
							on:click={() => {
								sttModelUpdateHandler();
							}}
							disabled={STT_WHISPER_MODEL_LOADING}
							aria-label={$i18n.t('settings.admin.audio.updateModel.label')}
						>
							{#if STT_WHISPER_MODEL_LOADING}
								<Spinner />
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 16 16"
									fill="currentColor"
									class="size-4"
								>
									<path
										d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z"
									/>
									<path
										d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z"
									/>
								</svg>
							{/if}
						</button>
					</div>
					<div class="mt-1 {linkedHelpClass}">
						<a href="https://github.com/SYSTRAN/faster-whisper" target="_blank">
							{$i18n.t(
								'Click here to learn more about faster-whisper and see the available models.'
							)}
						</a>
					</div>
				</AdminSettingField>
			{/if}
		</AdminSettingSection>

		<AdminSettingSection title={$i18n.t('settings.admin.audio.sections.textToSpeech.title')}>
			<AdminSettingRow
				label={$i18n.t('settings.admin.audio.textToSpeechEngine.label')}
				description={$i18n.t('settings.admin.audio.textToSpeechEngine.description')}
			>
				<SettingsSelect
					bind:value={TTS_ENGINE}
					placeholder={$i18n.t('Select a mode')}
					on:change={async () => {
						TTS_VOICE = '';
						TTS_MODEL = '';

						await updateConfigHandler();
						await getVoices();
						await getModels();
					}}
				>
					<option value="">{$i18n.t('Web API')}</option>
					<option value="transformers" disabled={$config?.features?.slim === true}
						>{$i18n.t('Transformers')} ({$i18n.t('Local')})</option
					>
					<option value="openai">{$i18n.t('OpenAI')}</option>
				</SettingsSelect>
			</AdminSettingRow>

			{#if TTS_ENGINE === 'openai'}
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<AdminSettingField label={$i18n.t('settings.admin.audio.ttsOpenaiApiBaseUrl.label')}>
						<input
							class={inputClass}
							placeholder={$i18n.t('settings.admin.audio.ttsOpenaiApiBaseUrl.label')}
							bind:value={TTS_OPENAI_API_BASE_URL}
							required
						/>
					</AdminSettingField>
					<AdminSettingField label={$i18n.t('settings.admin.audio.ttsOpenaiApiKey.label')}>
						<SensitiveInput
							variant="settings"
							placeholder={$i18n.t('settings.admin.audio.ttsOpenaiApiKey.label')}
							bind:value={TTS_OPENAI_API_KEY}
						/>
					</AdminSettingField>
				</div>
			{/if}

			{#if TTS_ENGINE === ''}
				<AdminSettingField label={$i18n.t('settings.admin.audio.ttsVoice.label')}>
					<SettingsSelect bind:value={TTS_VOICE} className="w-full">
						<option value="" selected={TTS_VOICE !== ''}>{$i18n.t('Default')}</option>
						{#each voices as voice}
							<option
								value={voice.voiceURI}
								class="bg-gray-100 dark:bg-gray-700"
								selected={TTS_VOICE === voice.voiceURI}>{voice.name}</option
							>
						{/each}
					</SettingsSelect>
				</AdminSettingField>
			{:else if TTS_ENGINE === 'transformers'}
				<!-- LICENSE covers this Open WebUI wordmark.
					Do not alter, remove, obscure, or replace it except as LICENSE permits:
					https://docs.openwebui.com/license. -->
				<AdminSettingField
					label={$i18n.t('settings.admin.audio.ttsModel.label')}
					description={$i18n.t('settings.admin.audio.ttsModel.description')}
				>
					<input
						class={inputClass}
						bind:value={TTS_MODEL}
						placeholder={$i18n.t('CMU ARCTIC speaker embedding name')}
					/>
					<div class="mt-1 {linkedHelpClass}">
						{$i18n.t('To learn more about SpeechT5,')}
						<a href="https://github.com/microsoft/SpeechT5" target="_blank">
							{$i18n.t('click here')}.
						</a>
						{$i18n.t('To see the available CMU Arctic speaker embeddings,')}
						<a href="https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors" target="_blank">
							{$i18n.t('click here')}.
						</a>
					</div>
				</AdminSettingField>
			{:else if TTS_ENGINE === 'openai'}
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<AdminSettingField label={$i18n.t('settings.admin.audio.ttsVoice.label')}>
						<TTSVoiceInput
							bind:value={TTS_VOICE}
							voices={providerVoices}
							placeholder={$i18n.t('Select a voice')}
							className={inputClass}
						/>
					</AdminSettingField>
					<AdminSettingField label={$i18n.t('settings.admin.audio.ttsModel.label')}>
						<input
							list="tts-model-list"
							class={inputClass}
							bind:value={TTS_MODEL}
							placeholder={$i18n.t('Select a model')}
						/>
					</AdminSettingField>
				</div>
				<AdminSettingField
					label={$i18n.t('settings.admin.audio.additionalParameters.label')}
					description={$i18n.t('settings.admin.audio.additionalParameters.description')}
				>
					<Textarea
						className={textareaClass}
						bind:value={TTS_OPENAI_PARAMS}
						placeholder={$i18n.t('Enter additional parameters in JSON format')}
					/>
				</AdminSettingField>
			{/if}

			<datalist id="tts-model-list">
				{#each models as model}
					<option value={model.id} class="bg-gray-50 dark:bg-gray-700"></option>
				{/each}
			</datalist>

			<AdminSettingRow
				label={$i18n.t('settings.admin.audio.responseSplitting.label')}
				description={$i18n.t('settings.admin.audio.responseSplitting.description')}
			>
				<SettingsSelect
					ariaLabel={$i18n.t('Select how to split message text for TTS requests')}
					bind:value={TTS_SPLIT_ON}
				>
					{#each [{ value: TTS_RESPONSE_SPLIT.PUNCTUATION, label: $i18n.t('Punctuation') }, { value: TTS_RESPONSE_SPLIT.PARAGRAPHS, label: $i18n.t('Paragraphs') }, { value: TTS_RESPONSE_SPLIT.NONE, label: $i18n.t('None') }] as split}
						<option value={split.value}>{split.label}</option>
					{/each}
				</SettingsSelect>
			</AdminSettingRow>
		</AdminSettingSection>
	</div>
	<div class="flex justify-end pt-6 text-sm font-normal">
		<button
			class="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-normal text-white transition hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
			type="submit"
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
