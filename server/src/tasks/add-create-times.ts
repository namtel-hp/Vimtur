import { Database, RouterTask, TaskRunnerCallback } from '../types';
import { ImportUtils } from '../cache/import-utils';
import { execute } from 'proper-job';

export class AddCreateTimes {
  public static getTask(db: Database): RouterTask {
    return {
      description: 'Get missing file creation times',
      runner: (updateStatus: TaskRunnerCallback) => {
        let complete = 0;
        return execute(
          async () => {
            const hashes = await db.subset({});
            return {
              init: hashes.length,
              iterable: hashes,
            };
          },
          async (hash, max) => {
            const media = await db.getMedia(hash);
            if (!media) {
              console.warn(`Unable to get media: ${media}`);
              return;
            }

            if (!media.metadata) {
              // Ignore, done as part of indexing.
              return;
            }

            if (media.metadata.createdAt) {
              // Already has date
              return;
            }

            const createdAt = await ImportUtils.getFileCreationTime(media.absolutePath);
            await db.saveMedia(hash, { metadata: { createdAt } });
            updateStatus(complete++, max || 0);
          },
          {
            parallel: 8,
          },
        );
      },
    };
  }
}
